/** Optional live integration test. Creates isolated test users and always removes them.
 * Requires EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * and SUPABASE_SERVICE_ROLE_KEY (server only). Never put the last key in EXPO_PUBLIC_*.
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL, key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const host=client(),reader=client(),outsider=client();
const ids=[];let channel;
const check=(r)=>{if(r.error)throw new Error(r.error.message);return r.data;};
try {
 const email=`skoolk-test-${randomUUID()}@example.invalid`,password=randomUUID()+randomUUID();
 const created=check(await admin.auth.admin.createUser({email,password,email_confirm:true}));ids.push(created.user.id);
 check(await host.auth.signInWithPassword({email,password}));
 ids.push(check(await reader.auth.signInAnonymously()).user.id);
 ids.push(check(await outsider.auth.signInAnonymously()).user.id);
 const roomId=check(await host.rpc('skoolk_create_room',{p_title:'A Toca da Raposa',p_author:'Nora Sakavic',p_synopsis:'Um grupo de jovens atletas, os Raposas, aprende a confiar uns nos outros. Neil é um recém-chegado reservado. Explore temas de pertencimento e confiança sem presumir acontecimentos específicos.',p_cover_url:null,p_chapter_start:1,p_chapter_end:3,p_count:3,p_nickname:'Teste Anfitriã'}));
 const room=check(await host.from('skoolk_rooms').select('*').eq('id',roomId).single());
 assert.equal(check(await outsider.from('skoolk_rooms').select('*').eq('id',roomId)).length,0);
 assert.equal(check(await reader.rpc('skoolk_join_room',{p_code:room.code,p_nickname:'Teste Leitor',p_avatar:1})),roomId);
 assert.ok((await reader.rpc('skoolk_advance_room',{p_room:roomId,p_version:0})).error);
 const denied=await reader.functions.invoke('generate-questions',{body:{roomId}});assert.ok(denied.error,'Reader must not generate questions');
 const skipAI=process.env.SKOOLK_SKIP_AI_TEST==='1';
 let generated;
 if(skipAI){
  check(await host.rpc('skoolk_write_questions',{p_room:roomId,p_questions:[1,2,3].map(i=>({category:'Discussão',prompt:`Pergunta editorial de teste ${i}: o que chamou sua atenção na leitura?`,hint:'Compartilhe com o clube.'}))}));
  console.log('SKIP: AI request intentionally omitted in this Realtime-focused test.');
 } else {
 generated=await host.functions.invoke('generate-questions',{body:{roomId}});
 if(generated.error){
  const body=await generated.error.context?.json?.().catch(()=>null);
  if(process.env.SKOOLK_ALLOW_MANUAL_TEST!=='1' || !(body?.providerStatus===503 || body?.error?.includes('demorou'))) throw new Error(body?.error??generated.error.message);
  console.warn('Gemini unavailable during live test:',body.error);
  check(await host.rpc('skoolk_write_questions',{p_room:roomId,p_questions:[1,2,3].map(i=>({category:'Discussão',prompt:`Pergunta editorial de teste ${i}: o que chamou sua atenção na leitura?`,hint:'Compartilhe com o clube.'}))}));
 } else assert.equal(generated.data.count,3);
 }
 const questions=check(await reader.from('skoolk_questions').select('*').eq('room_id',roomId).order('position'));
 assert.equal(questions.length,3);assert.ok(questions.every(q=>q.prompt.length>=10));
 console.log(skipAI || generated.error ? 'PASS: manually authored questions saved and delivered to the reader (AI unavailable).' : 'PASS: Gemini 3.8 Flash generated three questions; reader received them.');
 let notify;
 const realtimeEvent=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Realtime delivery timed out')),40000);notify=()=>{clearTimeout(t);resolve();};});
 channel=reader.channel(`integration-${roomId}`,{config:{postgres_changes_options:{wait:true,timeout:15000}}}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'skoolk_rooms',filter:`id=eq.${roomId}`},notify);
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Realtime subscription timed out')),25000);channel.subscribe((status,error)=>{if(status==='SUBSCRIBED'){clearTimeout(t);resolve();}if(status==='CHANNEL_ERROR'){clearTimeout(t);reject(new Error('Realtime channel error: '+error?.message));}});});
 let version=check(await host.from('skoolk_rooms').select('version').eq('id',roomId).single()).version;
 check(await host.rpc('skoolk_advance_room',{p_room:roomId,p_version:version++}));await realtimeEvent;
 console.log('PASS: host transition delivered over Supabase Realtime.');
 for(const q of questions){
  assert.ok((await reader.rpc('skoolk_rate_question',{p_room:roomId,p_question:q.id,p_stars:5})).error);
  check(await host.rpc('skoolk_advance_room',{p_room:roomId,p_version:version++}));
  check(await reader.rpc('skoolk_rate_question',{p_room:roomId,p_question:q.id,p_stars:5}));
  check(await reader.rpc('skoolk_rate_question',{p_room:roomId,p_question:q.id,p_stars:1}));
  const votes=check(await host.from('skoolk_ratings').select('*').eq('question_id',q.id));
  assert.equal(votes.length,1);assert.equal(votes[0].stars,5);
  check(await host.rpc('skoolk_advance_room',{p_room:roomId,p_version:version++}));
 }
 assert.equal(check(await reader.from('skoolk_rooms').select('phase').eq('id',roomId).single()).phase,'finished');
 check(await reader.rpc('skoolk_submit_feedback',{p_room:roomId,p_book:4,p_discussion:5}));
 assert.equal(check(await host.from('skoolk_feedback').select('*').eq('room_id',roomId)).length,1);
 console.log('PASS: full discussion/rating lifecycle, duplicate protection, final feedback and room isolation.');
} finally {
 if(channel)await reader.removeChannel(channel);
 await Promise.all([host.auth.signOut(),reader.auth.signOut(),outsider.auth.signOut()]);
 for(const id of ids)check(await admin.auth.admin.deleteUser(id));
 console.log(`Cleanup: removed ${ids.length} isolated test users and their room data.`);
}

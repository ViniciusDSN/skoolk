import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors as c } from '../theme';

export type TourPasso = { id: string; titulo: string; texto: string };
type Caixa = { x: number; y: number; width: number; height: number };

const ESPACO = 6;
const RAIO = 18;

const recorte = (largura: number, altura: number, f: Caixa) => {
  const r = Math.min(RAIO, f.width / 2, f.height / 2);
  const { x, y, width: w, height: h } = f;
  return `M0 0H${largura}V${altura}H0Z `
    + `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`
    + `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`
    + `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
};
const LARGURA_BALAO = 272;
const FOLGA_TOPO = 80;
const FOLGA_BASE = 200;

export function Tour({ passos, alvos, raiz, visivel, onFechar, aoRolar }: {
  passos: TourPasso[];
  alvos: React.MutableRefObject<Record<string, View | null>>;
  raiz: React.RefObject<View | null>;
  visivel: boolean;
  onFechar: () => void;
  aoRolar?: (deltaY: number) => void;
}) {
  const [estado, setEstado] = useState<{ indice: number; caixa: Caixa | null }>({ indice: 0, caixa: null });
  const { indice, caixa } = estado;
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [alturaBalao, setAlturaBalao] = useState(150);
  const vivo = useRef(true);

  const medir = useCallback((id: string) => new Promise<Caixa | null>(resolve => {
    const alvo = alvos.current[id];
    if (!alvo || !raiz.current) return resolve(null);
    alvo.measureLayout(raiz.current,
      (x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
      () => resolve(null));
  }), [alvos, raiz]);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => { setEstado({ indice: 0, caixa: null }); }, [visivel]);

  useEffect(() => {
    if (!visivel || !area.height || !passos[indice]) return;
    let cancelado = false;
    const passoAtual = indice, alvoId = passos[passoAtual].id;
    void (async () => {
      let posicao = await medir(alvoId);
      if (cancelado || !vivo.current) return;
      if (!posicao) {
        await new Promise(r => setTimeout(r, 140));
        if (cancelado || !vivo.current) return;
        posicao = await medir(alvoId);
        if (cancelado || !vivo.current) return;
      }
      if (!posicao && passoAtual < passos.length - 1) {
        setEstado(anterior => anterior.indice === passoAtual ? { indice: passoAtual + 1, caixa: null } : anterior);
        return;
      }
      if (posicao && aoRolar && (posicao.y < FOLGA_TOPO || posicao.y + posicao.height > area.height - FOLGA_BASE)) {
        const alto = posicao.height > area.height - FOLGA_TOPO - FOLGA_BASE;
        aoRolar(alto ? posicao.y - FOLGA_TOPO : posicao.y + posicao.height / 2 - area.height / 2);
        await new Promise(r => setTimeout(r, 450));
        if (cancelado || !vivo.current) return;
        posicao = await medir(alvoId);
        if (cancelado || !vivo.current) return;
      }
      setEstado(anterior => anterior.indice === passoAtual ? { indice: passoAtual, caixa: posicao } : anterior);
    })();
    return () => { cancelado = true; };
  }, [visivel, indice, passos, medir, aoRolar, area.height]);

  if (!visivel || !passos.length) return null;
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;
  const avancar = () => ultimo ? onFechar() : setEstado({ indice: indice + 1, caixa: null });

  const alturaMaxima = Math.max(96, Math.min(area.height * 0.5, area.height - alturaBalao - 56));
  const foco = caixa && area.height ? (() => {
    const topo = Math.max(8, caixa.y - ESPACO);
    return {
      x: caixa.x - ESPACO, y: topo,
      width: caixa.width + ESPACO * 2,
      height: Math.min(caixa.height + ESPACO * 2 - (topo - (caixa.y - ESPACO)), alturaMaxima),
    };
  })() : null;

  const abaixo = foco ? foco.y + foco.height + 14 + alturaBalao < area.height - 16 : true;
  const topoBalao = !foco ? Math.max(16, area.height / 2 - alturaBalao / 2)
    : abaixo ? foco.y + foco.height + 14
    : Math.max(16, foco.y - alturaBalao - 14);
  const esquerdaBalao = !foco ? Math.max(12, (area.width - LARGURA_BALAO) / 2)
    : Math.min(Math.max(12, foco.x + foco.width / 2 - LARGURA_BALAO / 2), Math.max(12, area.width - LARGURA_BALAO - 12));
  const esquerdaSeta = foco
    ? Math.min(Math.max(foco.x + foco.width / 2 - 9, esquerdaBalao + 18), esquerdaBalao + LARGURA_BALAO - 36)
    : area.width / 2 - 9;

  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setArea(anterior => anterior.width === width && anterior.height === height ? anterior : { width, height });
  }}>
    {foco ? <>
      <Svg pointerEvents="none" width={area.width} height={area.height} style={StyleSheet.absoluteFill}>
        <Path d={recorte(area.width, area.height, foco)} fill="#241630" fillOpacity={0.85} fillRule="evenodd" />
      </Svg>
      <Pressable style={[s.toque, { left: 0, top: 0, width: area.width, height: Math.max(0, foco.y) }]} onPress={avancar} />
      <Pressable style={[s.toque, { left: 0, top: foco.y + foco.height, width: area.width, height: Math.max(0, area.height - foco.y - foco.height) }]} onPress={avancar} />
      <Pressable style={[s.toque, { left: 0, top: foco.y, width: Math.max(0, foco.x), height: foco.height }]} onPress={avancar} />
      <Pressable style={[s.toque, { left: foco.x + foco.width, top: foco.y, width: Math.max(0, area.width - foco.x - foco.width), height: foco.height }]} onPress={avancar} />
      <View pointerEvents="none" style={[s.anel, { left: foco.x, top: foco.y, width: foco.width, height: foco.height }]} />
      <View pointerEvents="none" style={[s.seta, abaixo ? s.setaCima : s.setaBaixo,
        { left: esquerdaSeta, top: abaixo ? topoBalao - 10 : topoBalao + alturaBalao }]} />
    </> : <Pressable style={[s.veu, { left: 0, top: 0, width: area.width, height: area.height }]} onPress={avancar} />}

    <View accessibilityRole="alert" onLayout={event => setAlturaBalao(event.nativeEvent.layout.height)}
      style={[s.balao, { left: esquerdaBalao, top: topoBalao }]}>
      <Text style={s.contador}>{`PASSO ${indice + 1} DE ${passos.length}`}</Text>
      <Text style={s.titulo}>{passo.titulo}</Text>
      <Text style={s.texto}>{passo.texto}</Text>
      <View style={s.rodape}>
        <Pressable accessibilityRole="button" onPress={onFechar} style={s.pular}>
          <Text style={s.pularTexto}>Pular tutorial</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={avancar} style={s.proximo}>
          <Text style={s.proximoTexto}>{ultimo ? 'Entendi' : 'Próximo'}</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  veu: { position: 'absolute', backgroundColor: '#241630D9' },
  toque: { position: 'absolute' },
  anel: { position: 'absolute', borderWidth: 2, borderColor: '#fff', borderRadius: RAIO },
  seta: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  setaCima: { borderBottomWidth: 10, borderBottomColor: '#fff' },
  setaBaixo: { borderTopWidth: 10, borderTopColor: '#fff' },
  balao: { position: 'absolute', width: LARGURA_BALAO, backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 10 },
  contador: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: c.purple },
  titulo: { fontSize: 15, fontWeight: '600', color: c.ink },
  texto: { fontSize: 13, lineHeight: 20, color: '#5C5370' },
  rodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  pular: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  pularTexto: { fontSize: 12, color: c.muted },
  proximo: { minHeight: 40, borderRadius: 12, backgroundColor: c.purple, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  proximoTexto: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

/** A persistent scroll cue, including on iOS where native indicators fade away. */
export const ScrollArea = forwardRef<ScrollView, ScrollViewProps & { light?: boolean; compact?: boolean }>(
  function ScrollArea({ children, light = false, compact = false, style, contentContainerStyle, onScroll, onLayout, onContentSizeChange, ...props }, ref) {
    const scroll = useRef<ScrollView>(null);
    const [viewport, setViewport] = useState(0), [content, setContent] = useState(0), [offset, setOffset] = useState(0);
    useImperativeHandle(ref, () => scroll.current!);
    const contentStyle = StyleSheet.flatten(contentContainerStyle);
    const paddingBottom = Number(contentStyle?.paddingBottom ?? contentStyle?.paddingVertical ?? contentStyle?.padding ?? 0);
    const maxOffset = Math.max(0, content - viewport);
    // Bottom spacing is not hidden content and must not trigger the cue.
    const contentEnd = Math.max(0, content - paddingBottom);
    const overflow = viewport > 0 && contentEnd - viewport > 4;
    const moreBelow = overflow && contentEnd - Math.max(0, offset) - viewport > 8;
    const track = Math.max(0, viewport - 16);
    const thumb = Math.min(track, Math.max(28, track * viewport / Math.max(content, 1)));
    const position = Math.min(maxOffset, Math.max(0, offset)) / Math.max(maxOffset, 1) * (track - thumb);
    const paddingRight = compact ? Number(contentStyle?.paddingRight ?? contentStyle?.paddingHorizontal ?? contentStyle?.padding ?? 0) + 8 : undefined;
    return <View style={[styles.container, compact && { flex: undefined, flexShrink: 1 }, style]}>
      <ScrollView {...props} ref={scroll} style={{ flexGrow: 1, flexShrink: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={[contentContainerStyle, { paddingBottom }, compact && { paddingRight }]} scrollEventThrottle={16}
        onLayout={event => { setViewport(event.nativeEvent.layout.height); onLayout?.(event); }}
        onContentSizeChange={(width, height) => { setContent(height); onContentSizeChange?.(width, height); }}
        onScroll={event => { setOffset(event.nativeEvent.contentOffset.y); onScroll?.(event); }}>
        {children}
      </ScrollView>
      {overflow && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.track, { backgroundColor: light ? '#FFFFFF24' : '#7852BF1A' }]}>
        <View style={{ width: 4, height: thumb, borderRadius: 4, transform: [{ translateY: position }], backgroundColor: light ? '#E8D9FF' : '#9674CC' }} />
      </View>}
      {moreBelow && <View pointerEvents="box-none" style={styles.hintPosition}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver mais conteúdo abaixo" onPress={() => scroll.current?.scrollTo({ y: Math.min(maxOffset, offset + viewport * .7), animated: true })}
          style={[styles.hint, { backgroundColor: light ? '#56338F' : '#F0E9FA' }]}>
          <Text style={{ color: light ? '#fff' : '#68419F', fontSize: 11, fontWeight: '600' }}>Mais abaixo · deslize</Text>
          <ChevronDown size={16} color={light ? '#fff' : '#68419F'} />
        </Pressable>
      </View>}
    </View>;
  },
);
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, position: 'relative' },
  track: { position: 'absolute', right: 3, top: 8, bottom: 8, width: 4, borderRadius: 4 },
  hintPosition: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  hint: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
});

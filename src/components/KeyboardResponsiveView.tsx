import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme/tokens';

export function KeyboardResponsiveView({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const rootRef = useRef<View>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      requestAnimationFrame(() => rootRef.current?.measureInWindow((_, y, __, height) => {
        const overlap = Math.max(0, y + height - event.endCoordinates.screenY);
        setKeyboardInset(overlap > 0 ? Math.ceil(overlap + spacing.sm) : 0);
      }));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return (
    <View ref={rootRef} style={[styles.flex, style]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, keyboardInset > 0 && { paddingBottom: keyboardInset }]}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

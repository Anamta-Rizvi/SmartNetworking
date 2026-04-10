import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  category?: string;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
}

export function TagChip({ label, category, selected, onPress, small }: Props) {
  const categoryColor = category ? Colors.categoryColors[category] ?? Colors.primary : Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.chip,
        small && styles.small,
        { borderColor: categoryColor },
        selected && { backgroundColor: categoryColor },
      ]}
    >
      <Text style={[styles.label, small && styles.smallLabel, selected && styles.selectedLabel, { color: selected ? '#fff' : categoryColor }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    margin: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  smallLabel: {
    fontSize: 11,
  },
  selectedLabel: {
    color: '#fff',
  },
});

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Modal, FlatList } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface DropdownOption {
  label: string;
  value: string;
}

interface SettingsDropdownOptionProps {
  infoField: string;
  isDropdown: boolean;
  dropdownOptions?: DropdownOption[];
  selectedValue?: string;
  showSelectedValueInTitle?: boolean;
  onDropdownSelect?: (value: string) => void;
  note?: string | null;
}

export function SettingsDropdownOption({
  infoField,
  isDropdown,
  dropdownOptions,
  selectedValue,
  showSelectedValueInTitle,
  onDropdownSelect,
  note,
}: SettingsDropdownOptionProps) {
  const themeColors = useThemeColors();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handlePress = () => {
    if (isDropdown) setIsDropdownVisible(true);
    else Alert.alert(infoField);
  };

  const handleOptionSelect = (option: DropdownOption) => {
    setIsDropdownVisible(false);
    if (onDropdownSelect) onDropdownSelect(option.value);
  };

  return (
    <View className="items-center">
      <View className="w-80 bg-muted dark:bg-muted-dark border border-border dark:border-border-dark rounded-xl">
        <TouchableOpacity onPress={handlePress}>
          <Text className="p-4 text-lg text-center text-foreground dark:text-foreground-dark">
            {isDropdown && selectedValue && showSelectedValueInTitle
              ? `${infoField}: ${
                dropdownOptions?.find((opt) => opt.value === selectedValue)?.label ||
                selectedValue
              }`
              : infoField}
          </Text>
        </TouchableOpacity>
      </View>

      {isDropdown && (
        <Modal
          transparent
          visible={isDropdownVisible}
          onRequestClose={() => setIsDropdownVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 justify-center items-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onPress={() => setIsDropdownVisible(false)}
            activeOpacity={1}
          >
            <View className="w-[200px] max-h-[300px] bg-card dark:bg-card-dark rounded-lg p-2 shadow-lg">
              <FlatList
                data={dropdownOptions}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className={`flex-row justify-between items-center py-2 px-3 rounded ${
                      selectedValue === item.value ? "bg-muted dark:bg-muted-dark" : ""
                    }`}
                    onPress={() => handleOptionSelect(item)}
                  >
                    <Text
                      className={`text-sm ${
                        selectedValue === item.value
                          ? "font-bold text-foreground dark:text-foreground-dark"
                          : "text-muted-foreground dark:text-muted-foreground-dark"
                      }`}
                    >
                      {item.label}
                    </Text>
                    {selectedValue === item.value && (
                      <Text style={{ color: themeColors.primary, fontWeight: "bold" }}>✔</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
              {note && <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark mt-1 text-center">{note}</Text>}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

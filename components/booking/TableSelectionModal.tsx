// components/booking/TableSelectionModal.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, MapPin, Users, Info } from "lucide-react-native";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

interface Table {
  id: string;
  table_number: string;
  table_type: string;
  capacity: number;
  x_position: number;
  y_position: number;
  shape: string;
  width: number;
  height: number;
  features: string[];
  is_available?: boolean;
}

interface FloorPlan {
  id: string;
  name: string;
  width: number;
  height: number;
}

interface TableSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTable: (table: Table | null) => void;
  restaurantId: string;
  bookingDate: Date;
  bookingTime: string;
  partySize: number;
  selectedTableId?: string | null;
}

const TABLE_TYPE_CONFIG = {
  window: { color: "#3b82f6", icon: "🪟", label: "Window" },
  patio: { color: "#10b981", icon: "🌿", label: "Patio" },
  booth: { color: "#8b5cf6", icon: "🛋️", label: "Booth" },
  standard: { color: "#6b7280", icon: "🪑", label: "Standard" },
  bar: { color: "#f59e0b", icon: "🍺", label: "Bar" },
  private: { color: "#ef4444", icon: "🚪", label: "Private" },
};

const FEATURE_LABELS: Record<string, string> = {
  window_view: "Window View",
  corner: "Corner Table",
  quiet: "Quiet Area",
  romantic: "Romantic Setting",
  family: "Family Friendly",
  outdoor: "Outdoor",
  garden_view: "Garden View",
};

export function TableSelectionModal({
  visible,
  onClose,
  onSelectTable,
  restaurantId,
  bookingDate,
  bookingTime,
  partySize,
  selectedTableId,
}: TableSelectionModalProps) {
  const { colorScheme } = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<Table[]>([]);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Calculate screen dimensions for responsive layout
  const screenWidth = Dimensions.get("window").width;
  const floorPlanWidth = screenWidth - 32; // 16px padding on each side
  const floorPlanHeight = floorPlanWidth * 0.8; // 4:5 aspect ratio

  // Fetch tables and availability
  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch floor plan
      const { data: floorPlanData, error: floorPlanError } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_default", true)
        .single();

      if (floorPlanError) throw floorPlanError;
      setFloorPlan(floorPlanData);

      // Fetch all tables for the restaurant
      const { data: tablesData, error: tablesError } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

      if (tablesError) throw tablesError;

      // Check availability for each table
      const tablesWithAvailability = await Promise.all(
        tablesData.map(async (table) => {
          // Check if table is available for the selected time slot
          const { data: availabilityData } = await supabase
            .from("table_availability")
            .select("*")
            .eq("table_id", table.id)
            .eq("date", bookingDate.toISOString().split("T")[0])
            .eq("time_slot", bookingTime);

          const isAvailable = !availabilityData || availabilityData.length === 0 || 
                              availabilityData[0].is_available;

          return {
            ...table,
            is_available: isAvailable && table.capacity >= partySize,
          };
        })
      );

      setTables(tablesWithAvailability);

      // Pre-select table if ID provided
      if (selectedTableId) {
        const table = tablesWithAvailability.find(t => t.id === selectedTableId);
        if (table) setSelectedTable(table);
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
      Alert.alert("Error", "Failed to load table layout");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, bookingDate, bookingTime, partySize, selectedTableId]);

  useEffect(() => {
    if (visible) {
      fetchTables();
    }
  }, [visible, fetchTables]);

  const handleTableSelect = (table: Table) => {
    if (!table.is_available) {
      Alert.alert(
        "Table Unavailable",
        table.capacity < partySize
          ? `This table only seats ${table.capacity} people. You need a table for ${partySize}.`
          : "This table is not available for your selected time.",
        [{ text: "OK" }]
      );
      return;
    }
    setSelectedTable(table);
  };

  const handleConfirmSelection = () => {
    onSelectTable(selectedTable);
    onClose();
  };

  const renderTable = (table: Table) => {
    const config = TABLE_TYPE_CONFIG[table.table_type as keyof typeof TABLE_TYPE_CONFIG];
    const isSelected = selectedTable?.id === table.id;
    const scale = floorPlanWidth / 100; // Convert percentage to pixels

    return (
      <Pressable
        key={table.id}
        onPress={() => handleTableSelect(table)}
        style={{
          position: "absolute",
          left: table.x_position * scale,
          top: table.y_position * scale,
          width: table.width * scale,
          height: table.height * scale,
          backgroundColor: table.is_available
            ? isSelected
              ? config.color
              : `${config.color}20`
            : colorScheme === "dark"
            ? "#374151"
            : "#e5e7eb",
          borderWidth: 2,
          borderColor: table.is_available
            ? isSelected
              ? config.color
              : `${config.color}60`
            : colorScheme === "dark"
            ? "#4b5563"
            : "#d1d5db",
          borderRadius: table.shape === "circle" ? 100 : 8,
          alignItems: "center",
          justifyContent: "center",
          opacity: table.is_available ? 1 : 0.5,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "bold",
            color: isSelected ? "#fff" : colorScheme === "dark" ? "#fff" : "#000",
          }}
        >
          {table.table_number}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: isSelected ? "#fff" : colorScheme === "dark" ? "#9ca3af" : "#6b7280",
          }}
        >
          {config.icon} {table.capacity}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <H3>Select Your Table</H3>
          <Pressable onPress={onClose} className="p-2">
            <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-muted-foreground">Loading table layout...</Text>
          </View>
        ) : (
          <>
            {/* Table Type Legend */}
            <Pressable
              onPress={() => setShowLegend(!showLegend)}
              className="mx-4 mt-4 p-3 bg-muted rounded-lg flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2">
                <Info size={16} />
                <Text className="font-medium">Table Types & Features</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                {showLegend ? "Hide" : "Show"}
              </Text>
            </Pressable>

            {showLegend && (
              <View className="mx-4 mt-2 p-3 bg-card rounded-lg border border-border">
                <View className="flex-row flex-wrap gap-3">
                  {Object.entries(TABLE_TYPE_CONFIG).map(([type, config]) => (
                    <View key={type} className="flex-row items-center gap-1">
                      <View
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: config.color }}
                      />
                      <Text className="text-sm">
                        {config.icon} {config.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Floor Plan */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="px-4 mt-4">
                <View
                  className="bg-card rounded-lg border border-border overflow-hidden"
                  style={{
                    width: floorPlanWidth,
                    height: floorPlanHeight,
                    position: "relative",
                  }}
                >
                  {/* Background grid for visual reference */}
                  <View className="absolute inset-0 opacity-5">
                    {[...Array(10)].map((_, i) => (
                      <View
                        key={`h-${i}`}
                        className="absolute w-full border-b border-muted-foreground"
                        style={{ top: `${i * 10}%` }}
                      />
                    ))}
                    {[...Array(10)].map((_, i) => (
                      <View
                        key={`v-${i}`}
                        className="absolute h-full border-r border-muted-foreground"
                        style={{ left: `${i * 10}%` }}
                      />
                    ))}
                  </View>

                  {/* Render tables */}
                  {tables.map(renderTable)}
                </View>

                {/* Selected Table Info */}
                {selectedTable && (
                  <View className="mt-4 p-4 bg-muted rounded-lg">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="font-bold text-lg">
                        Table {selectedTable.table_number}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Users size={16} />
                        <Text>Seats {selectedTable.capacity}</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-2 mb-2">
                      <Text className="text-sm">
                        {TABLE_TYPE_CONFIG[selectedTable.table_type as keyof typeof TABLE_TYPE_CONFIG].icon}
                        {" "}
                        {TABLE_TYPE_CONFIG[selectedTable.table_type as keyof typeof TABLE_TYPE_CONFIG].label}
                      </Text>
                    </View>

                    {selectedTable.features.length > 0 && (
                      <View className="flex-row flex-wrap gap-2 mt-2">
                        {selectedTable.features.map((feature) => (
                          <View
                            key={feature}
                            className="px-2 py-1 bg-background rounded-full"
                          >
                            <Text className="text-xs">
                              {FEATURE_LABELS[feature] || feature}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="px-4 py-4 border-t border-border">
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => {
                    setSelectedTable(null);
                    onSelectTable(null);
                    onClose();
                  }}
                  className="flex-1"
                >
                  <Text>No Preference</Text>
                </Button>
                <Button
                  onPress={handleConfirmSelection}
                  disabled={!selectedTable}
                  className="flex-1"
                >
                  <Text className="text-primary-foreground">
                    {selectedTable ? "Select Table" : "Choose a Table"}
                  </Text>
                </Button>
              </View>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
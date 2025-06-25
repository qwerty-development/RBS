// components/booking/TableLayoutPreview.tsx
import React, { useEffect, useState } from "react";
import { View, ScrollView, Dimensions, ActivityIndicator } from "react-native";
import { supabase } from "@/config/supabase";
import { Text } from "@/components/ui/text";
import { P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { TABLE_TYPE_CONFIG } from "@/constants/tableConfig";

interface TableLayoutPreviewProps {
  restaurantId: string;
  showCapacity?: boolean;
  interactive?: boolean;
  onTablePress?: (table: any) => void;
}

export function TableLayoutPreview({
  restaurantId,
  showCapacity = true,
  interactive = false,
  onTablePress,
}: TableLayoutPreviewProps) {
  const { colorScheme } = useColorScheme();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const screenWidth = Dimensions.get("window").width;
  const previewWidth = screenWidth - 32;
  const previewHeight = previewWidth * 0.8;

  useEffect(() => {
    fetchTables();
  }, [restaurantId]);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="h-64 items-center justify-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View className="h-64 items-center justify-center bg-muted rounded-lg">
        <P className="text-muted-foreground">No table layout available</P>
      </View>
    );
  }

  const scale = previewWidth / 100;

  return (
    <View
      className="bg-card rounded-lg border border-border overflow-hidden"
      style={{ width: previewWidth, height: previewHeight }}
    >
      {/* Grid background */}
      <View className="absolute inset-0 opacity-5">
        {[...Array(5)].map((_, i) => (
          <View
            key={`h-${i}`}
            className="absolute w-full border-b border-muted-foreground"
            style={{ top: `${i * 25}%` }}
          />
        ))}
        {[...Array(5)].map((_, i) => (
          <View
            key={`v-${i}`}
            className="absolute h-full border-r border-muted-foreground"
            style={{ left: `${i * 25}%` }}
          />
        ))}
      </View>

      {/* Tables */}
      {tables.map((table) => {
        const config = TABLE_TYPE_CONFIG[table.table_type as keyof typeof TABLE_TYPE_CONFIG] || TABLE_TYPE_CONFIG.standard;
        
        return (
          <View
            key={table.id}
            onTouchEnd={() => interactive && onTablePress?.(table)}
            style={{
              position: "absolute",
              left: table.x_position * scale,
              top: table.y_position * scale,
              width: table.width * scale,
              height: table.height * scale,
              backgroundColor: `${config.color}20`,
              borderWidth: 1.5,
              borderColor: config.color,
              borderRadius: table.shape === "circle" ? 100 : 6,
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.8,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "600" }}>
              {table.table_number}
            </Text>
            {showCapacity && (
              <Text style={{ fontSize: 8, opacity: 0.7 }}>
                {config.icon} {table.capacity}
              </Text>
            )}
          </View>
        );
      })}

      {/* Legend */}
      <View className="absolute bottom-2 left-2 right-2 bg-background/90 rounded p-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {Object.entries(TABLE_TYPE_CONFIG).map(([type, config]) => (
              <View key={type} className="flex-row items-center gap-1">
                <View
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: config.color }}
                />
                <Text style={{ fontSize: 10 }}>
                  {config.icon} {config.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
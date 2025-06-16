import React from "react";
import { View, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2 } from "@/components/ui/typography";
import { useLocation } from "@/hooks/useLocation";

const LEBANESE_LOCATIONS = [
    {
      city: "Beirut",
      districts: [
        "Achrafieh",
        "Hamra",
        "Downtown",
        "Mar Mikhael",
        "Gemmayzeh",
        "Verdun",
        "Ras Beirut",
        "Badaro",
        "Sodeco",
        "Sassine",
        "Ain El Mreisseh",
        "Raouche",
        "Manara",
        "Mazraa",
        "Tarik Jdideh",
      ],
    },
    {
      city: "Mount Lebanon",
      districts: [
        "Jounieh",
        "Jbeil (Byblos)",
        "Baabda",
        "Aley",
        "Broummana",
        "Beit Mery",
        "Dbayeh",
        "Zalka",
        "Antelias",
        "Jal el Dib",
        "Kaslik",
        "Zouk Mosbeh",
        "Naccache",
        "Rabweh",
        "Bikfaya",
      ],
    },
    {
      city: "North Lebanon",
      districts: [
        "Tripoli",
        "Batroun",
        "Chekka",
        "Koura",
        "Zgharta",
        "Bcharre",
        "Amioun",
        "Kousba",
        "Anfeh",
      ],
    },
    {
      city: "South Lebanon",
      districts: [
        "Saida (Sidon)",
        "Tyre (Sour)",
        "Nabatieh",
        "Jezzine",
        "Marjayoun",
        "Bint Jbeil",
      ],
    },
    {
      city: "Bekaa",
      districts: [
        "Zahle",
        "Baalbek",
        "Chtaura",
        "Anjar",
        "Rayak",
        "Bar Elias",
      ],
    },
  ];

export default function LocationSelectorScreen() {
  const router = useRouter();
  const { location, refresh } = useLocation();

  const handleSelectDistrict = async (city: string, district: string) => {
    const newLocation = { city, district };
    
    // Save to storage
    await AsyncStorage.setItem("@selected_location", JSON.stringify(newLocation));
    
    // Refresh location hook
    await refresh();
    
    // Navigate back
    router.back();
  };

  const renderLocationGroup = ({ item }: { item: typeof LEBANESE_LOCATIONS[0] }) => (
    <View className="mb-6">
      <Text className="font-semibold text-lg px-4 mb-3 text-muted-foreground">
        {item.city}
      </Text>
      {item.districts.map((district) => (
        <Pressable
          key={`${item.city}-${district}`}
          onPress={() => handleSelectDistrict(item.city, district)}
          className="flex-row items-center justify-between px-4 py-4 bg-card mx-4 mb-2 rounded-lg"
        >
          <View>
            <Text className="font-medium">{district}</Text>
            <Text className="text-sm text-muted-foreground">{item.city}</Text>
          </View>
          {location?.district === district && (
            <Check size={20} color="#10b981" />
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 py-4 border-b border-border">
        <H2>Choose Your Location</H2>
      </View>
      
      <FlatList
        data={LEBANESE_LOCATIONS}
        renderItem={renderLocationGroup}
        keyExtractor={(item) => item.city}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 16 }}
      />
    </SafeAreaView>
  );
}
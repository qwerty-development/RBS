import React, { useState, useEffect } from "react";
import { Image as ExpoImage, ImageProps } from "expo-image";
import { ImageSourcePropType } from "react-native";
import { cssInterop } from "nativewind";
import { imageCache } from "@/utils/imageCache";

interface CachedImageProps extends Omit<ImageProps, "source"> {
  source: ImageSourcePropType | { uri: string | null } | string | null;
}

const CachedImage: React.FC<CachedImageProps> = ({ source, ...props }) => {
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchCachedImage = async () => {
      let uri: string | null = null;

      // Only try to cache remote URIs (strings that start with http)
      if (typeof source === "string" && source.startsWith("http")) {
        uri = source;
      } else if (
        source &&
        typeof source === "object" &&
        "uri" in source &&
        source.uri &&
        source.uri.startsWith("http")
      ) {
        uri = source.uri;
      }

      if (uri) {
        const cached = await imageCache.getCachedImage(uri);
        setCachedUri(cached);
      }
    };

    fetchCachedImage();
  }, [source]);

  // Create a safe source for ExpoImage
  const getSafeSource = (): any => {
    // If we have a cached URI, use it
    if (cachedUri) {
      return { uri: cachedUri };
    }

    // Handle null/undefined
    if (!source) {
      return undefined;
    }

    // Handle objects with uri property - ensure uri is not null
    if (typeof source === "object" && "uri" in source) {
      if (!source.uri) {
        return undefined;
      }
      return { uri: source.uri };
    }

    // For all other cases (local assets, strings), ExpoImage can handle it
    return source;
  };

  const imageSource = getSafeSource();

  return <ExpoImage source={imageSource} {...props} />;
};

const StyledImage = cssInterop(CachedImage, {
  className: "style",
});

export { StyledImage as Image };

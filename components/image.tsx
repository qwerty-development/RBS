import React, { useState, useEffect } from "react";
import { Image as ExpoImage, ImageProps } from "expo-image";
import { cssInterop } from "nativewind";
import { imageCache } from "@/utils/imageCache";

interface CachedImageProps extends ImageProps {
  source: { uri: string };
}

const CachedImage: React.FC<CachedImageProps> = ({ source, ...props }) => {
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchCachedImage = async () => {
      if (source?.uri) {
        const cached = await imageCache.getCachedImage(source.uri);
        setCachedUri(cached);
      }
    };

    fetchCachedImage();
  }, [source?.uri]);

  const imageSource = cachedUri ? { uri: cachedUri } : source;

  return <ExpoImage source={imageSource} {...props} />;
};

const StyledImage = cssInterop(CachedImage, {
  className: "style",
});

export { StyledImage as Image };

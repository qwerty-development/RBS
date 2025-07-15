// utils/imageUpload.ts
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";

interface UploadImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  bucket?: string;
  folder?: string;
}

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Convert base64 to blob
export const base64ToBlob = (
  base64: string,
  contentType: string = "image/jpeg",
): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

// Compress and resize image
export const processImage = async (
  uri: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {},
): Promise<ImageManipulator.ImageResult> => {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = options;

  // Get image info
  const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // Calculate resize dimensions
  const { width, height } = imageInfo;
  let resizeWidth = width;
  let resizeHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;

    if (width > height) {
      resizeWidth = maxWidth;
      resizeHeight = maxWidth / aspectRatio;
    } else {
      resizeHeight = maxHeight;
      resizeWidth = maxHeight * aspectRatio;
    }
  }

  // Process image
  return await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: resizeWidth, height: resizeHeight } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
};

// Upload single image to Supabase
export const uploadImage = async (
  imageData: {
    uri: string;
    base64?: string;
  },
  userId: string,
  options: UploadImageOptions = {},
): Promise<{ url: string; path: string } | null> => {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    bucket = "images",
    folder = "posts",
  } = options;

  try {
    // Process image
    const processedImage = await processImage(imageData.uri, {
      maxWidth,
      maxHeight,
      quality,
    });

    if (!processedImage.base64) {
      throw new Error("Failed to process image");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${timestamp}-${randomId}.jpg`;
    const filePath = `${folder}/${userId}/${fileName}`;

    // Convert to blob and upload
    const blob = base64ToBlob(processedImage.base64);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};

// Upload multiple images
export const uploadImages = async (
  images: { uri: string; base64?: string }[],
  userId: string,
  options: UploadImageOptions = {},
): Promise<string[]> => {
  const uploadPromises = images.map((image) =>
    uploadImage(image, userId, options),
  );
  const results = await Promise.all(uploadPromises);

  return results
    .filter(
      (result): result is { url: string; path: string } => result !== null,
    )
    .map((result) => result.url);
};

// Delete image from storage
export const deleteImage = async (
  imagePath: string,
  bucket: string = "images",
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([imagePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
};

// Pick images from gallery
export const pickImagesFromGallery = async (
  options: {
    allowsMultipleSelection?: boolean;
    maxSelection?: number;
  } = {},
): Promise<ImagePicker.ImagePickerAsset[] | null> => {
  const { allowsMultipleSelection = true, maxSelection = 5 } = options;

  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Please allow access to your photo library to upload images.",
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection,
    quality: 1,
    base64: true,
  });

  if (result.canceled) {
    return null;
  }

  // Limit selection
  if (result.assets.length > maxSelection) {
    Alert.alert(
      "Too Many Images",
      `You can only select up to ${maxSelection} images at once.`,
    );
    return result.assets.slice(0, maxSelection);
  }

  return result.assets;
};

// Take photo with camera
export const takePhotoWithCamera =
  async (): Promise<ImagePicker.ImagePickerAsset | null> => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take photos.",
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: true,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  };

// Validate image
export const validateImage = (
  image: ImagePicker.ImagePickerAsset,
): { valid: boolean; error?: string } => {
  // Check file type
  if (image.type && !ALLOWED_IMAGE_TYPES.includes(image.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload JPEG, PNG, or WebP images.",
    };
  }

  // Check file size (if available)
  if (image.fileSize && image.fileSize > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: "Image is too large. Maximum size is 5MB.",
    };
  }

  return { valid: true };
};

// Get image dimensions
export const getImageDimensions = async (
  uri: string,
): Promise<{ width: number; height: number } | null> => {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return {
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return null;
  }
};

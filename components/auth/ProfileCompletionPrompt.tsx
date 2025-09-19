import React, { useState, useCallback } from "react";
import {
  View,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import {
  User,
  AlertTriangle,
  Shield,
  X,
  Phone,
  Calendar,
  CheckCircle,
} from "lucide-react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Text } from "@/components/ui/text";
import { H2, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { MissingField } from "@/hooks/useProfileCompletion";
import { InputValidator } from "@/lib/security";

// Lebanese Phone Number Validation
// Comprehensive regex for Lebanese phone numbers (mobile and landline)
const lebanesPhoneRegex =
  /^(\+961|961)?(03|70|71|76|78|79|80|81|1|3|4|5|6|7|8|9)\d{5,7}$/;

// Utility function to format date input with automatic dashes
const formatDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 4) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  } else {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  }
};

// Utility function to validate date format
const isValidDateFormat = (dateString: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    dateString === date.toISOString().split("T")[0]
  );
};

// Dynamic schema based on current field
const createFieldSchema = (field: MissingField) => {
  switch (field) {
    case "first_name":
      return z.object({
        value: z
          .string()
          .min(1, "First name is required")
          .max(25, "First name must be less than 25 characters")
          .regex(
            /^[a-zA-Z\s\u0600-\u06FF]+$/,
            "Please enter a valid first name",
          )
          .refine(
            (name) => {
              const validation = InputValidator.validateContent(name, {
                maxLength: 25,
                minLength: 1,
                checkProfanity: true,
                fieldName: "first name",
              });
              return validation.isValid;
            },
            {
              message: "Please use appropriate language in your first name",
            },
          ),
      });

    case "last_name":
      return z.object({
        value: z
          .string()
          .min(1, "Last name is required")
          .max(25, "Last name must be less than 25 characters")
          .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid last name")
          .refine(
            (name) => {
              const validation = InputValidator.validateContent(name, {
                maxLength: 25,
                minLength: 1,
                checkProfanity: true,
                fieldName: "last name",
              });
              return validation.isValid;
            },
            {
              message: "Please use appropriate language in your last name",
            },
          ),
      });

    case "phone_number":
      return z.object({
        value: z
          .string()
          .min(1, "Phone number is required")
          .regex(
            lebanesPhoneRegex,
            "Please enter a valid Lebanese phone number",
          )
          .transform((val) => {
            // If already in +961 format, keep it as is
            if (val.startsWith("+961")) {
              return val;
            }
            // Add +961 prefix for Lebanese mobile numbers starting with 03, 7, or 8
            if (
              val.startsWith("03") ||
              val.startsWith("7") ||
              val.startsWith("8")
            ) {
              return `+961${val.replace(/^0/, "")}`;
            }
            // Handle 961 without + prefix
            if (val.startsWith("961")) {
              return `+${val}`;
            }
            // For landline numbers (1, 3-9 without 0 prefix) add +961
            if (/^[1-9]\d{5,7}$/.test(val)) {
              return `+961${val}`;
            }
            return val;
          }),
      });

    case "date_of_birth":
      return z.object({
        value: z
          .string()
          .min(1, "Please enter your date of birth.")
          .refine((date) => {
            return isValidDateFormat(date);
          }, "Please enter a valid date in YYYY-MM-DD format.")
          .refine((date) => {
            const parsedDate = new Date(date);
            const today = new Date();
            const age = today.getFullYear() - parsedDate.getFullYear();
            const monthDiff = today.getMonth() - parsedDate.getMonth();
            const dayDiff = today.getDate() - parsedDate.getDate();

            return (
              age > 13 ||
              (age === 13 &&
                (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)))
            );
          }, "You must be at least 13 years old.")
          .refine((date) => {
            const parsedDate = new Date(date);
            const today = new Date();
            return parsedDate <= today;
          }, "Date of birth cannot be in the future."),
      });

    default:
      return z.object({ value: z.string() });
  }
};

type FormData = z.infer<ReturnType<typeof createFieldSchema>>;

interface FieldConfig {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  autoComplete?: string;
  isDateField?: boolean;
  canSkip?: boolean;
}

const fieldConfigs: Record<MissingField, FieldConfig> = {
  first_name: {
    title: "Add Your First Name",
    description:
      "Enter your first name to personalize your experience and help restaurants identify you.",
    icon: User,
    placeholder: "John",
    autoCapitalize: "words",
    autoComplete: "given-name",
    canSkip: false,
  },
  last_name: {
    title: "Add Your Last Name",
    description:
      "Enter your last name to complete your profile and ensure proper identification.",
    icon: User,
    placeholder: "Doe",
    autoCapitalize: "words",
    autoComplete: "family-name",
    canSkip: false,
  },
  phone_number: {
    title: "Add Your Phone Number",
    description:
      "We need your phone number for booking confirmations and important notifications about your reservations.",
    icon: Phone,
    placeholder: "03 123 456",
    keyboardType: "phone-pad",
    autoComplete: "tel",
    canSkip: false,
  },
  date_of_birth: {
    title: "Add Your Date of Birth",
    description:
      "We need your date of birth for age verification at certain venues. This information can only be set once for security purposes.",
    icon: Calendar,
    placeholder: "YYYY-MM-DD",
    keyboardType: "numeric",
    maxLength: 10,
    isDateField: true,
    canSkip: true,
  },
};

interface ProfileCompletionPromptProps {
  visible: boolean;
  currentField?: MissingField;
  missingFields: MissingField[];
  onComplete: () => void;
  onNext: () => void;
  onSkip?: () => void;
  mandatory?: boolean;
  getBestAvailableName?: () => string;
  splitName?: (fullName: string) => { first_name: string; last_name: string };
}

export const ProfileCompletionPrompt: React.FC<
  ProfileCompletionPromptProps
> = ({
  visible,
  currentField,
  missingFields,
  onComplete,
  onNext,
  onSkip,
  mandatory = false,
  getBestAvailableName,
  splitName: propSplitName,
}) => {
  const { profile, updateProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enteredValues, setEnteredValues] = useState<Record<string, string>>(
    {},
  );

  const fieldConfig = currentField ? fieldConfigs[currentField] : null;
  const currentFieldIndex = currentField
    ? missingFields.indexOf(currentField)
    : -1;
  const totalFields = missingFields.length;
  const isLastField = currentFieldIndex === totalFields - 1;

  const splitName = useCallback((fullName: string) => {
    const nameParts = (fullName || "").trim().split(/\s+/);
    return {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
    };
  }, []);

  const getDefaultValue = useCallback(() => {
    if (!currentField) return "";

    if (currentField === "first_name" || currentField === "last_name") {
      // Use the provided functions if available, otherwise use local splitName
      const useSplitName = propSplitName || splitName;
      const useGetBestName =
        getBestAvailableName || (() => profile?.full_name || "");

      const bestName = useGetBestName();
      const { first_name, last_name } = useSplitName(bestName);

      if (currentField === "first_name") {
        // Use entered value if available, otherwise check if current first name is "User"
        const enteredFirstName = enteredValues.first_name;
        if (enteredFirstName) return enteredFirstName;
        // If the first name is "User" (generic fallback), return empty string to let user enter real name
        return first_name === "User" ? "" : first_name;
      } else {
        // Use entered value if available, otherwise return current last name
        const enteredLastName = enteredValues.last_name;
        return enteredLastName || last_name;
      }
    }

    if (currentField === "phone_number") {
      return profile?.phone_number || "";
    }

    if (currentField === "date_of_birth") {
      return profile?.date_of_birth || "";
    }

    return "";
  }, [
    currentField,
    propSplitName,
    splitName,
    getBestAvailableName,
    profile,
    enteredValues,
  ]);

  const form = useForm<FormData>({
    resolver: fieldConfig
      ? zodResolver(createFieldSchema(currentField!))
      : undefined,
    defaultValues: {
      value: getDefaultValue(),
    },
  });

  // Update form when field changes
  React.useEffect(() => {
    const defaultValue = getDefaultValue();
    form.reset({ value: defaultValue });
  }, [currentField, getDefaultValue, form]);

  // Clear entered values when modal is closed
  React.useEffect(() => {
    if (!visible) {
      setEnteredValues({});
    }
  }, [visible]);

  const handleSubmit = async (data: FormData) => {
    if (!currentField || !fieldConfig) return;

    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      let updateData: any = {};

      if (currentField === "first_name" || currentField === "last_name") {
        // For name fields, we need to update the full_name
        // Use entered values from this session, not just profile state
        const useSplitName = propSplitName || splitName;
        const useGetBestName =
          getBestAvailableName || (() => profile?.full_name || "");
        const { first_name: currentFirstName, last_name: currentLastName } =
          useSplitName(useGetBestName());

        // Use entered values if available, otherwise fall back to current values
        const firstName =
          currentField === "first_name"
            ? data.value.trim()
            : enteredValues.first_name || currentFirstName;
        const lastName =
          currentField === "last_name"
            ? data.value.trim()
            : enteredValues.last_name || currentLastName;

        updateData.full_name = `${firstName} ${lastName}`.trim();

        // Store the entered value for future reference
        setEnteredValues((prev) => ({
          ...prev,
          [currentField]: data.value.trim(),
        }));
      } else {
        // For other fields, update directly
        updateData[currentField] = data.value;
      }

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile?.id);

      if (error) {
        throw error;
      }

      // Update local profile state
      await updateProfile(updateData);

      // Reset form
      form.reset({ value: "" });

      // Move to next field or complete
      if (isLastField) {
        // Clear entered values when completing
        setEnteredValues({});
        onComplete();
        setTimeout(() => {
          Alert.alert(
            "Profile Complete!",
            "Your profile has been successfully updated with all required information.",
          );
        }, 100);
      } else {
        onNext();
      }
    } catch (error: any) {
      console.error(`Error setting ${currentField}:`, error);
      Alert.alert(
        "Error",
        error.message || `Failed to set ${currentField}. Please try again.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (!fieldConfig?.canSkip && mandatory) {
      Alert.alert(
        "Required Information",
        `${fieldConfig?.title || "This field"} is required to continue.`,
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Skip Field",
      `You can add this information later in your profile settings.`,
      [
        { text: "Add Now", style: "default" },
        {
          text: "Skip",
          style: "cancel",
          onPress: () => {
            if (isLastField) {
              // Clear entered values when completing
              setEnteredValues({});
              onComplete();
            } else {
              onNext();
            }
            onSkip?.();
          },
        },
      ],
    );
  };

  if (!visible || !currentField || !fieldConfig) return null;

  const IconComponent = fieldConfig.icon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <TouchableWithoutFeedback onPress={() => {}}>
            <View className="bg-background w-full max-w-md rounded-xl p-6 shadow-lg">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <IconComponent size={24} className="text-primary mr-3" />
                  <H2 className="flex-1">{fieldConfig.title}</H2>
                </View>
                {fieldConfig.canSkip && onSkip && (
                  <Button variant="ghost" size="sm" onPress={handleSkip}>
                    <X size={20} />
                  </Button>
                )}
              </View>

              {/* Progress indicator */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm text-muted-foreground">
                  Step {currentFieldIndex + 1} of {totalFields}
                </Text>
                <View className="flex-row gap-1">
                  {missingFields.map((_, index) => (
                    <View
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index <= currentFieldIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </View>
              </View>

              {/* Description */}
              <P className="text-muted-foreground mb-6 leading-relaxed">
                {fieldConfig.description}
              </P>

              {/* Warning for DOB */}
              {currentField === "date_of_birth" && (
                <View className="flex-row items-start bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg mb-6 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle
                    size={20}
                    className="text-amber-600 dark:text-amber-400 mt-0.5 mr-3"
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-amber-700 dark:text-amber-300 mb-1">
                      One-Time Setting
                    </Text>
                    <Text className="text-sm text-amber-600 dark:text-amber-400">
                      Your date of birth can only be set once and cannot be
                      changed afterward for security and verification purposes.
                    </Text>
                  </View>
                </View>
              )}

              {/* Form */}
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormInput
                      {...field}
                      label={fieldConfig.title.replace("Add Your ", "")}
                      placeholder={fieldConfig.placeholder}
                      description={
                        fieldConfig.isDateField
                          ? "Enter your birth year, month, and day (dashes added automatically)"
                          : undefined
                      }
                      autoCapitalize={fieldConfig.autoCapitalize}
                      autoCorrect={false}
                      keyboardType={fieldConfig.keyboardType || "default"}
                      maxLength={fieldConfig.maxLength}
                      autoComplete={fieldConfig.autoComplete as any}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      onChangeText={(text: string) => {
                        const formatted = fieldConfig.isDateField
                          ? formatDateInput(text)
                          : text;
                        field.onChange(formatted);
                      }}
                    />
                  )}
                />
              </Form>

              {/* Security Note for DOB */}
              {currentField === "date_of_birth" && (
                <View className="flex-row items-center mt-4 mb-6">
                  <Shield
                    size={16}
                    className="text-green-600 dark:text-green-400 mr-2"
                  />
                  <Text className="text-xs text-muted-foreground flex-1">
                    Your date of birth is used only for age verification and is
                    kept secure
                  </Text>
                </View>
              )}

              {/* Actions */}
              <View className="flex-row gap-3 mt-6">
                {fieldConfig.canSkip && onSkip && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={handleSkip}
                    disabled={isSubmitting}
                  >
                    <Text>Skip for Now</Text>
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onPress={form.handleSubmit(handleSubmit)}
                  disabled={isSubmitting}
                >
                  {isLastField ? (
                    <CheckCircle size={16} className="text-white mr-2" />
                  ) : (
                    <IconComponent size={16} className="text-white mr-2" />
                  )}
                  <Text className="text-white font-medium">
                    {isSubmitting
                      ? "Saving..."
                      : isLastField
                        ? "Complete Profile"
                        : "Next"}
                  </Text>
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

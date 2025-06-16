import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";

// Note: Add this Checkbox component to your UI components
const Checkbox = ({ checked, onCheckedChange, className }: any) => {
	return (
		<Pressable
			onPress={() => onCheckedChange(!checked)}
			className={cn(
				"h-5 w-5 rounded border-2 border-primary items-center justify-center",
				checked && "bg-primary",
				className
			)}
		>
			{checked && (
				<View className="h-3 w-3 bg-white rounded-sm" />
			)}
		</Pressable>
	);
};

export { Checkbox };
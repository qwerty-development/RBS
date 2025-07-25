import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable } from "react-native";
import { cn } from "@/lib/utils";
import { TextClassContext } from "@/components/ui/text";
import { useButtonAccessibility } from "@/hooks/useAccessibility";

const buttonVariants = cva(
  "group flex items-center justify-center rounded-3xl web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary web:hover:opacity-90 active:opacity-90",
        destructive: "bg-destructive web:hover:opacity-90 active:opacity-90",
        outline:
          "border border-input bg-background web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent",
        secondary: "bg-secondary web:hover:opacity-80 active:opacity-80",
        ghost:
          "web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent",
        link: "web:underline-offset-4 web:hover:underline web:focus:underline",
      },
      size: {
        default: "h-10 px-4 py-2 native:h-12 native:px-5 native:py-3",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-2xl px-8 native:h-14",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva(
  "web:whitespace-nowrap text-sm native:text-base font-medium text-foreground web:transition-colors",
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        destructive: "text-destructive-foreground",
        outline: "group-active:text-accent-foreground",
        secondary:
          "text-secondary-foreground group-active:text-secondary-foreground",
        ghost: "group-active:text-accent-foreground",
        link: "text-primary group-active:underline",
      },
      size: {
        default: "",
        sm: "",
        lg: "native:text-lg",
        icon: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Accessibility label for the button
     */
    accessibilityLabel?: string;
    /**
     * Accessibility hint for the button
     */
    accessibilityHint?: string;
    /**
     * Whether the button is in a loading state
     */
    loading?: boolean;
    /**
     * Whether this is a destructive action
     */
    destructive?: boolean;
  };

const Button = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  ButtonProps
>(({ 
  className, 
  variant, 
  size, 
  accessibilityLabel,
  accessibilityHint,
  loading,
  destructive,
  children,
  ...props 
}, ref) => {
  const { getButtonProps } = useButtonAccessibility();

  // Determine button label from children if not provided
  const buttonLabel = accessibilityLabel || 
    (typeof children === 'string' ? children : 'Button');

  // Get accessibility props
  const accessibilityProps = getButtonProps(buttonLabel, {
    loading,
    disabled: props.disabled,
    destructive: destructive || variant === 'destructive',
    hint: accessibilityHint,
  });

  return (
    <TextClassContext.Provider
      value={buttonTextVariants({
        variant,
        size,
        className: "web:pointer-events-none",
      })}
    >
      <Pressable
        className={cn(
          props.disabled && "opacity-50 web:pointer-events-none",
          buttonVariants({ variant, size, className }),
        )}
        ref={ref}
        role="button"
        {...accessibilityProps}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
});
Button.displayName = "Button";

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };

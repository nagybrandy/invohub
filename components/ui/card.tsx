// components/ui/card.tsx
// shadcn/react-native-reusables Card family: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm shadow-black/5",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      role="heading"
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight text-card-foreground",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn("flex flex-row items-center p-6 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

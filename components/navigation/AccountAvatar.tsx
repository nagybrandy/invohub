// components/navigation/AccountAvatar.tsx
// Square (radius 8) initials avatar for a billing account, 32px by default.
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { accountAvatarFill, accountInitials } from "@/components/navigation/account-avatar";

export function AccountAvatar({
  id,
  name,
  active = false,
  size = 32,
  round = false,
  testID,
}: {
  id: string;
  name?: string | null;
  active?: boolean;
  size?: number;
  /** The signed-in person's avatar is a navy circle; companies are rounded squares. */
  round?: boolean;
  testID?: string;
}) {
  const fill = round ? "bg-navy" : accountAvatarFill(id, active);
  return (
    <Box
      testID={testID}
      aria-hidden
      className={`items-center justify-center ${round ? "rounded-full" : "rounded-control"} ${fill}`}
      style={{ width: size, height: size }}
    >
      <Text className="text-xs font-bold text-white">{accountInitials(name)}</Text>
    </Box>
  );
}

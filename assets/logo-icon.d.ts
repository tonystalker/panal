declare module "@/assets/logo-icon" {
  import type { FC, HTMLAttributes } from "react";
  const LogoIcon: FC<HTMLAttributes<HTMLDivElement> & { className?: string }>;
  export default LogoIcon;
  export { LogoIcon };
}

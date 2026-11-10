/** Join class names, skipping falsy values. Dependency-free `clsx` subset. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

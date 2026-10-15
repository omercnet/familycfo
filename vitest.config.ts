import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // other sessions' git worktrees live under .claude/ — their tests aren't this checkout's
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});

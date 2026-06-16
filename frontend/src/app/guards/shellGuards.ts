export type ShellAccessState = {
  isAuthenticated: boolean;
  hasWorkspace: boolean;
  isReadOnly: boolean;
  pathname: string;
};

export type ShellGuardResult = {
  canRenderShell: boolean;
  readOnlyReason?: string;
  routeRequiresWorkspace: boolean;
};

const userScopedRoutes = [/^\/profile(?:\/|$)/, /^\/settings\/admin(?:\/|$)/];

export function evaluateShellAccess(state: ShellAccessState): ShellGuardResult {
  const routeRequiresWorkspace = !userScopedRoutes.some((pattern) => pattern.test(state.pathname));
  if (!state.isAuthenticated) {
    return { canRenderShell: false, routeRequiresWorkspace };
  }
  if (routeRequiresWorkspace && !state.hasWorkspace) {
    return { canRenderShell: false, routeRequiresWorkspace };
  }
  return {
    canRenderShell: true,
    routeRequiresWorkspace,
    readOnlyReason: state.isReadOnly ? "Temporary access grant: write actions are restricted." : undefined,
  };
}

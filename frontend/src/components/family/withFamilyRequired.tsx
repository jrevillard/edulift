import React from 'react';
import { FamilyRequiredRoute } from './FamilyRequiredRoute';

/**
 * Higher-order component version for easier usage
 */
export const withFamilyRequired = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const FamilyRequiredComponent = (props: P) => (
    <FamilyRequiredRoute>
      <Component {...props} />
    </FamilyRequiredRoute>
  );

  FamilyRequiredComponent.displayName = `withFamilyRequired(${Component.displayName || Component.name})`;

  return FamilyRequiredComponent;
};
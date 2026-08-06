import React, { Component } from "react";
import { BudgetsSection } from "../finance/BudgetsSection";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error in BudgetsTab", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-100 text-red-900 rounded-xl m-6">
          <h1 className="text-2xl font-bold">Error en Presupuestos</h1>
          <pre className="mt-4 whitespace-pre-wrap text-sm">{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export const BudgetsTab = ({
	user,
	clients = [],
	treatments = [],
	profile,
	showToast,
	onStartSessionFromBudget,
}) => {
	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<ErrorBoundary>
				<BudgetsSection
					user={user}
					clients={clients}
					treatments={treatments}
					profile={profile}
					showToast={showToast}
					onStartSessionFromBudget={onStartSessionFromBudget}
				/>
			</ErrorBoundary>
		</div>
	);
};


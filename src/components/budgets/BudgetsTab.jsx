import React from "react";
import { BudgetsSection } from "../finance/BudgetsSection";

export const BudgetsTab = ({ user, clients = [], treatments = [], profile, showToast }) => {
	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<BudgetsSection
				user={user}
				clients={clients}
				treatments={treatments}
				profile={profile}
				showToast={showToast}
			/>
		</div>
	);
};


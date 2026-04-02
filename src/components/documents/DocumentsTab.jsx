import React, { useMemo, useState } from "react";
import { FileText, FolderOpen, ReceiptText } from "lucide-react";
import { BudgetsTab } from "../budgets/BudgetsTab";
import { RequirePlan } from "../guards/RequirePlan";
import { ConsentTemplatesTab } from "./ConsentTemplatesTab";

const DOC_TABS = [
	{ id: "consents", label: "Consentimientos", icon: FileText },
	{ id: "budgets", label: "Presupuestos", icon: ReceiptText, requiresPlan: true },
];

export const DocumentsTab = ({ user, clients = [], treatments = [], profile, showToast }) => {
	const [activeDocTab, setActiveDocTab] = useState("consents");

	const tabs = useMemo(() => DOC_TABS, []);

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			<div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
						<FolderOpen size={20} />
					</div>
					<div>
						<h2 className="text-2xl font-bold text-gray-800">Documentos</h2>
						<p className="text-sm text-gray-500">Consentimientos, presupuestos y más.</p>
					</div>
				</div>
				<div className="flex gap-2 flex-wrap">
					{tabs.map((t) => {
						const Icon = t.icon;
						const active = activeDocTab === t.id;
						return (
							<button
								key={t.id}
								type="button"
								onClick={() => setActiveDocTab(t.id)}
								className={`px-4 py-2 rounded-xl font-bold text-sm border transition-colors flex items-center gap-2 ${
									active
										? "bg-gray-900 text-white border-gray-900"
										: "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
								}`}>
								<Icon size={16} />
								{t.label}
							</button>
						);
					})}
				</div>
			</div>

			{activeDocTab === "consents" && <ConsentTemplatesTab user={user} showToast={showToast} />}

			{activeDocTab === "budgets" && (
				<RequirePlan>
					<BudgetsTab user={user} clients={clients} treatments={treatments} profile={profile} showToast={showToast} />
				</RequirePlan>
			)}
		</div>
	);
};


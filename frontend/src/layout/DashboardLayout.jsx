import { Outlet } from "react-router-dom";
import Modal from "@/components/common/Modal";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";

export default function DashboardLayout() {
	return (
		<>
			<SidebarProvider>
				<AppSidebar />
				<div className="cloud-app-shell flex min-h-screen min-w-0 flex-1 flex-col">
					<header className="cloud-topbar sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 px-5 sm:px-8">
						<div className="flex min-w-0 items-center gap-3">
							<SidebarTrigger className="md:hidden" />
							<div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
								<span className="font-semibold text-slate-800">Oasis</span><span>/</span><span>Workspace</span>
							</div>
							<h1 className="text-lg font-bold tracking-tight text-slate-800 md:hidden">Oasis</h1>
						</div>
						<div className="flex items-center gap-3">
							<div className="cloud-avatar" aria-label="Oasis workspace">OA</div>
						</div>
					</header>
					<main className="cloud-main w-full flex-1 px-4 pb-10 pt-5 sm:px-7 lg:px-9">
						<Outlet />
					</main>
				</div>
			</SidebarProvider>
			<Modal />
		</>
	);
}

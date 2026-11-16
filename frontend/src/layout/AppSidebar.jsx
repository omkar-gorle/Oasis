import { Button } from "@/components/ui/button";
import useLogout from "@/features/auth/hooks/useLogout";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import clsx from "clsx";
import { FileUp, FolderPlus, HardDrive, Home, LogOut, Plus, Trash, UserRound, Users, Cloud } from "lucide-react";
import { useRef } from "react";
import { useDispatch } from "react-redux";
import { NavLink } from "react-router-dom";
import { openModal } from "@/store/modal/modalSlice";
import UploadFile from "@/features/files/components/File/UploadFile";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const menuOptions = [
	{ label: "My Drive", path: "/", icon: <Home size={18} /> },
	{ label: "Shared with me", path: "/shared-with-me", icon: <Users size={18} /> },
	{ label: "Bin", path: "/trash", icon: <Trash size={18} /> },
	{ label: "Profile & settings", path: "/me", icon: <UserRound size={18} /> },
];

const AppSidebar = () => {
	const dispatch = useDispatch();
	const uploadRef = useRef();
	const isMobile = useIsMobile();
	const { mutateAsync: logoutUser } = useLogout();

	const handleFileUploadClick = () => uploadRef.current?.openFileDialog();

	return (
		<>
			<Sidebar side={isMobile ? "right" : "left"} className="cloud-sidebar">
				<SidebarHeader className="px-5 pb-5 pt-7">
					<div className="flex items-center gap-3 px-1">
						<div className="cloud-brand-mark"><Cloud size={22} strokeWidth={2.4} /></div>
						<div className="text-left">
							<h1 className="text-[21px] font-extrabold tracking-tight text-slate-900">Oasis</h1>
							<p className="text-[11px] font-medium tracking-[0.16em] text-slate-400">YOUR SPACE, ORGANIZED</p>
						</div>
					</div>
				</SidebarHeader>
				<SidebarContent className="px-3">
					<SidebarGroup className="pb-5">
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild>
										<DropdownMenu>
											<DropdownMenuTrigger className="cloud-create-button flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold">
												<Plus size={19} /> Create new
											</DropdownMenuTrigger>
											<DropdownMenuContent className="w-56" align="start">
												<DropdownMenuItem onClick={() => dispatch(openModal({ modalType: "newFolder", title: "New Folder" }))}>
													<FolderPlus /> New folder
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={handleFileUploadClick}><FileUp /> Upload files</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					<SidebarGroup>
						<p className="cloud-nav-label">LIBRARY</p>
						<SidebarGroupContent>
							<SidebarMenu>
								{menuOptions.map((item) => (
									<SidebarMenuItem key={item.path}>
										<SidebarMenuButton asChild>
											<NavItem to={item.path} icon={item.icon} label={item.label} />
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					<div className="cloud-sidebar-note mx-2 mt-auto mb-5 rounded-2xl p-4">
						<div className="mb-2 flex items-center gap-2 text-slate-700"><HardDrive size={16} /><span className="text-xs font-bold">Your cloud workspace</span></div>
						<p className="text-xs leading-5 text-slate-500">Keep your files together and access them whenever you need.</p>
					</div>
				</SidebarContent>
				<SidebarFooter className="border-t border-slate-100 p-4">
					<SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild>
						<Button onClick={() => logoutUser()} variant="ghost" className="h-10 w-full justify-start gap-3 rounded-xl px-3 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><LogOut size={17} /> Sign out</Button>
					</SidebarMenuButton></SidebarMenuItem></SidebarMenu>
				</SidebarFooter>
			</Sidebar>
			<UploadFile ref={uploadRef} />
		</>
	);
};

export default AppSidebar;

function NavItem({ to, icon, label }) {
	return <NavLink to={to} className={({ isActive }) => clsx("cloud-nav-item flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all", isActive && "cloud-nav-active")}>
		{icon}<span>{label}</span>
	</NavLink>;
}

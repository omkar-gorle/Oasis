import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import Files from "./File";
import Folder from "./Folder";
import toast from "react-hot-toast";
import useMoveFile from "../hooks/useMoveFile";
import BreadCrumb from "./BreadCrumb";
import GlobalContextMenu from "./ContextMenu/GlobalContextMenu";
import ContextMenuWrapper from "./ContextMenu/ContextMenuWrapper";
import FileSearchFilter from "./Toolbar/FileSearchFilter";
import useSearch from "../hooks/useSearch";
import { useState } from "react";
import SingleFile from "./File/SingleFile";
import Loader from "@/components/common/Loader";

const ListFiles = () => {
	const { mutateAsync: moveFile } = useMoveFile();

	const [search, setSearch] = useState("");
	const [type, setType] = useState("all");

	const { data: files, isLoading, isError } = useSearch({ search, type });

	const mouseSensor = useSensor(MouseSensor, {
		activationConstraint: {
			distance: 8, // ✅ drag only starts after 8px movement
		},
	});

	const touchSensor = useSensor(TouchSensor, {
		activationConstraint: {
			distance: 20,
			delay: 300,
			tolerance: 5,
		},
	});

	const sensors = useSensors(mouseSensor, touchSensor);

	const handleDrag = async (event) => {
		const { active, over } = event;

		if (!active || !over || active?.id === over?.id) return;

		const destinationFolder = over?.data?.current?.file;
		const sourceFile = active?.data?.current?.file;
		const payload = { action: "move", parent: destinationFolder?._id };
		await moveFile(
			{ id: sourceFile?._id, payload },
			{
				onSuccess: (data) => {
					toast.success(`${sourceFile?.name} moved to ${destinationFolder?.name}`);
				},
				onError: (error) => {
					if (error?.response) {
						const { data } = error?.response;
						console.log(data);
						toast.error(data?.message || "Failed to move file");
						return;
					}
					toast.error("Failed to move file");
				},
			},
		);
	};

	return (
		<ContextMenuWrapper>
			<section className="cloud-page-heading">
				<div>
					<p className="cloud-eyebrow">YOUR WORKSPACE</p>
					<h2 className="cloud-page-title">My Drive</h2>
					<p className="mt-1 text-sm text-slate-500">All your files and folders, in one place.</p>
				</div>
				
			</section>
			<div className="cloud-toolbar">
				<FileSearchFilter setSearch={setSearch} search={search} setType={setType} type={type} />
			</div>
			{isLoading && (
				<div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
					<Loader />
					<span className="ml-3 text-sm text-slate-500">Loading your files…</span>
				</div>
			)}
			{isError && !isLoading && (
				<p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">We couldn’t load your files. Check your connection and try again.</p>
			)}
			{!isLoading && !isError && files?.length > 0 && (
				<div className="flex min-h-[70vh] flex-col gap-5">
					<div className="cloud-section-heading"><BreadCrumb /></div>
					<DndContext autoScroll={false} sensors={sensors} onDragEnd={handleDrag}>
						<div className="grid cursor-default grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
							{files?.map((file) => (
								<SingleFile key={file?._id} file={file} />
							))}
						</div>
					</DndContext>
				</div>
			)}
			{!isLoading && !isError && (!files || files?.length === 0) && (
				<div className="flex min-h-[70vh] flex-col gap-5">
					<div className="cloud-section-heading"><BreadCrumb /></div>
					{(search || type !== "all") && <p className="text-center text-muted-foreground">No files found</p>}
					<DndContext autoScroll={false} sensors={sensors} onDragEnd={handleDrag}>
						<Folder />
						<Files />
					</DndContext>
				</div>
			)}
			<GlobalContextMenu />
		</ContextMenuWrapper>
	);
};

export default ListFiles;

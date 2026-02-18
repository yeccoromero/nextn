'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { getProjects, createProject, deleteProject, duplicateProject, updateProjectName } from '@/lib/local-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, PlusCircle, Pencil, Copy, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const { user, isUserLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // State for context menu actions
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [projectNameForRename, setProjectNameForRename] = useState('');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (user) {
      setIsLoadingProjects(true);
      const userProjects = getProjects(user.uid);
      setProjects(userProjects.map(p => ({ id: p.id, name: p.name })));
      setIsLoadingProjects(false);
    }
  }, [user]);

  const handleCreateProject = () => {
    if (!user || !newProjectName.trim()) return;
    const newProjectId = createProject(user.uid, newProjectName);
    toast({
      title: "Project Created",
      description: `Successfully created "${newProjectName}".`,
    });
    router.push(`/projects/${newProjectId}`);
  };

  const handleOpenRenameDialog = (project: Project) => {
    setRenamingProject(project);
    setProjectNameForRename(project.name);
  };

  const handleConfirmRename = () => {
    if (!renamingProject || !projectNameForRename.trim()) return;
    updateProjectName(renamingProject.id, projectNameForRename.trim());
    setProjects(projects.map(p => p.id === renamingProject.id ? { ...p, name: projectNameForRename.trim() } : p));
    toast({ title: "Project renamed successfully" });
    setRenamingProject(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingProject) return;
    deleteProject(deletingProject.id);
    setProjects(projects.filter(p => p.id !== deletingProject.id));
    toast({ title: "Project deleted" });
    setDeletingProject(null);
  };

  const handleDuplicateProject = (project: Project) => {
    if (!user) return;
    const newProject = duplicateProject(user.uid, project);
    setProjects(prev => [...prev, newProject]);
    toast({ title: "Project duplicated" });
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isUserLoading || !user) {
    return <div className="flex h-screen w-screen items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b px-8">
        <h1 className="text-xl font-bold">Vectoria</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user.displayName}</span>
          <Button variant="ghost" onClick={handleLogout}>Log Out</Button>
        </div>
      </header>
      <main className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Your Projects</h2>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Give your new project a name to get started.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="col-span-3"
                    placeholder="My Awesome Design"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                >
                  Create Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoadingProjects ? (
          <p>Loading projects...</p>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-colors hover:border-primary/50 group"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="truncate group-hover:text-primary transition-colors">{project.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => handleOpenRenameDialog(project)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDuplicateProject(project)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onSelect={() => setDeletingProject(project)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                    <p className="text-sm text-muted-foreground">Preview</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-medium">No projects yet</h3>
            <p className="text-muted-foreground mt-2">Click &quot;New Project&quot; to get started.</p>
          </div>
        )}
      </main>

      {/* Rename Project Dialog */}
      <Dialog open={!!renamingProject} onOpenChange={(isOpen) => !isOpen && setRenamingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rename-name" className="text-right">
                Name
              </Label>
              <Input
                id="rename-name"
                value={projectNameForRename}
                onChange={(e) => setProjectNameForRename(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingProject(null)}>Cancel</Button>
            <Button onClick={handleConfirmRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Alert Dialog */}
      <AlertDialog open={!!deletingProject} onOpenChange={(isOpen) => !isOpen && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project &quot;{deletingProject?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

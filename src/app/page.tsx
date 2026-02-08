'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { createProject, deleteProject, duplicateProject, updateProjectName } from '@/lib/db';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
import { signOut } from 'firebase/auth';

interface Project {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
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
      const fetchProjects = async () => {
        try {
          setIsLoadingProjects(true);

          const userProjectsQuery = query(
            collection(db, "projects"),
            where("ownerId", "==", user.uid)
          );

          const querySnapshot = await getDocs(userProjectsQuery);
          const userProjects = querySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
          }));
          setProjects(userProjects);
        } catch (error) {
          console.error("Error fetching projects:", error);
          toast({
            variant: "destructive",
            title: "Error fetching projects",
            description: "Could not load your projects. Please try again later.",
          });
        } finally {
          setIsLoadingProjects(false);
        }
      };
      fetchProjects();
    }
  }, [user, db, toast]);

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const newProjectId = await createProject(db, user.uid, newProjectName);
      toast({
        title: "Project Created",
        description: `Successfully created "${newProjectName}".`,
      });
      router.push(`/projects/${newProjectId}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error creating project",
        description: "Could not create the project. Please check permissions and try again.",
      });
      setIsCreatingProject(false);
    }
  };

  const handleOpenRenameDialog = (project: Project) => {
    setRenamingProject(project);
    setProjectNameForRename(project.name);
  };

  const handleConfirmRename = async () => {
    if (!renamingProject || !projectNameForRename.trim()) return;
    try {
      await updateProjectName(db, renamingProject.id, projectNameForRename.trim());
      setProjects(projects.map(p => p.id === renamingProject.id ? { ...p, name: projectNameForRename.trim() } : p));
      toast({ title: "Project renamed successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to rename project" });
    } finally {
      setRenamingProject(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(db, deletingProject.id);
      setProjects(projects.filter(p => p.id !== deletingProject.id));
      toast({ title: "Project deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to delete project" });
    } finally {
      setDeletingProject(null);
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    if (!user) return;
    try {
      const newProject = await duplicateProject(db, user.uid, project);
      setProjects(prev => [...prev, newProject]);
      toast({ title: "Project duplicated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to duplicate project" });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "There was an error signing out.",
      });
    }
  };

  if (isUserLoading || !user) {
    return <div className="flex h-screen w-screen items-center justify-center bg-canvas">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b px-8">
        <h1 className="text-xl font-bold">Vectoria</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user.email}</span>
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
                  disabled={isCreatingProject || !newProjectName.trim()}
                >
                  {isCreatingProject ? 'Creating...' : 'Create Project'}
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
              <Card key={project.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="cursor-pointer flex-1" onClick={() => router.push(`/projects/${project.id}`)}>
                    <CardTitle className="truncate">{project.name}</CardTitle>
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
                <CardContent className="cursor-pointer" onClick={() => router.push(`/projects/${project.id}`)}>
                  <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center">
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
              project "{deletingProject?.name}".
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

/**
 * Simple localStorage-based project database.
 * Replaces all Firestore CRUD operations for fully local development.
 */

import { nanoid } from 'nanoid';

export interface LocalProject {
    id: string;
    name: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
}

const PROJECTS_KEY = 'vectoria-projects';

function getAll(): LocalProject[] {
    try {
        const raw = localStorage.getItem(PROJECTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveAll(projects: LocalProject[]) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getProjects(userId: string): LocalProject[] {
    return getAll().filter(p => p.ownerId === userId);
}

export function createProject(userId: string, projectName: string): string {
    const projects = getAll();
    const id = nanoid();
    const now = new Date().toISOString();
    projects.push({ id, name: projectName, ownerId: userId, createdAt: now, updatedAt: now });
    saveAll(projects);
    return id;
}

export function deleteProject(projectId: string) {
    const projects = getAll().filter(p => p.id !== projectId);
    saveAll(projects);
    // Also remove project editor state
    localStorage.removeItem(`vectoria-editor-state-${projectId}`);
}

export function updateProjectName(projectId: string, newName: string) {
    const projects = getAll();
    const p = projects.find(p => p.id === projectId);
    if (p) {
        p.name = newName;
        p.updatedAt = new Date().toISOString();
        saveAll(projects);
    }
}

export function duplicateProject(userId: string, projectToDuplicate: { id: string; name: string }): { id: string; name: string } {
    const newName = `Copy of ${projectToDuplicate.name}`;
    const newId = createProject(userId, newName);

    // Copy editor state if exists
    const originalState = localStorage.getItem(`vectoria-editor-state-${projectToDuplicate.id}`);
    if (originalState) {
        localStorage.setItem(`vectoria-editor-state-${newId}`, originalState);
    }

    return { id: newId, name: newName };
}

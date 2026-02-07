'use client';
import {
  Firestore,
  addDoc,
  collection,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ProjectSchema, MemberSchema } from '@/lib/schemas';
import { z } from 'zod';

export async function createProject(db: Firestore, userId: string, projectName: string): Promise<string> {
  const projectsCol = collection(db, 'projects');

  // Validate project name before creating
  const nameValidation = z.string().min(1, "Project name cannot be empty");
  const validatedName = nameValidation.parse(projectName);

  const projectData = {
    ownerId: userId,
    name: validatedName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: 1,
  };

  const newProjectRef = await addDoc(projectsCol, projectData).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: 'projects',
        operation: 'create',
        requestResourceData: projectData,
      })
    );
    throw error;
  });

  const memberDocRef = doc(db, 'projects', newProjectRef.id, 'members', userId);
  const memberData = { role: 'owner' as const };

  // Validate member data before saving
  const validatedMember = MemberSchema.parse(memberData);

  await setDoc(memberDocRef, validatedMember).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: memberDocRef.path,
        operation: 'create',
        requestResourceData: validatedMember,
      })
    );
    throw error;
  });

  return newProjectRef.id;
}

export async function deleteProject(db: Firestore, projectId: string) {
  const projectRef = doc(db, 'projects', projectId);
  // Note: This doesn't delete subcollections. For a production app,
  // this should be handled by a Firebase Function.
  await deleteDoc(projectRef).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: projectRef.path,
        operation: 'delete',
      })
    );
    throw error;
  });
}

export async function updateProjectName(db: Firestore, projectId: string, newName: string) {
  // Validate project name before updating
  const nameValidation = z.string().min(1, "Project name cannot be empty");
  const validatedName = nameValidation.parse(newName);

  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, { name: validatedName }).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: projectRef.path,
        operation: 'update',
        requestResourceData: { name: validatedName },
      })
    );
    throw error;
  })
}

export async function duplicateProject(db: Firestore, userId: string, projectToDuplicate: { id: string, name: string }) {
  const newName = `Copy of ${projectToDuplicate.name}`;
  const newProjectId = await createProject(db, userId, newName);

  const docsColRef = collection(db, 'projects', projectToDuplicate.id, 'docs');
  const docsSnapshot = await getDocs(docsColRef);

  const batch = writeBatch(db);
  docsSnapshot.forEach(docSnap => {
    const newDocRef = doc(db, 'projects', newProjectId, 'docs', docSnap.id);
    batch.set(newDocRef, docSnap.data());
  });
  await batch.commit().catch(error => {
    // A generic error for the batch
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: `projects/${newProjectId}/docs`,
        operation: 'write',
        requestResourceData: {}, // data can be large, omitting for brevity
      })
    );
    throw error;
  });

  return { id: newProjectId, name: newName };
}

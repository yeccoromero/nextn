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

export async function createProject(db: Firestore, userId: string, projectName: string): Promise<string> {
  const projectsCol = collection(db, 'projects');
  
  const projectData = {
    ownerId: userId,
    name: projectName,
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
  const memberData = { role: 'owner' };
  
  await setDoc(memberDocRef, memberData).catch(error => {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: memberDocRef.path,
        operation: 'create',
        requestResourceData: memberData,
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
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, { name: newName }).catch(error => {
         errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: projectRef.path,
            operation: 'update',
            requestResourceData: { name: newName },
          })
        );
        throw error;
    })
}

export async function duplicateProject(db: Firestore, userId: string, projectToDuplicate: {id: string, name: string}) {
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

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { StrategicLesson, LearningEvent } from './types';
import fs from 'fs';
import path from 'path';

const LEARNING_DIR = path.join(process.cwd(), 'scratch', 'learning');
const LESSONS_FILE = path.join(LEARNING_DIR, 'lessons.json');
const EVENTS_FILE = path.join(LEARNING_DIR, 'events.json');

function ensureLocalStorage() {
  if (!fs.existsSync(LEARNING_DIR)) {
    fs.mkdirSync(LEARNING_DIR, { recursive: true });
  }
  if (!fs.existsSync(LESSONS_FILE)) {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify([]), 'utf-8');
  }
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify([]), 'utf-8');
  }
}

function getLocalLessons(): StrategicLesson[] {
  ensureLocalStorage();
  try {
    const raw = fs.readFileSync(LESSONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalLessons(lessons: StrategicLesson[]) {
  ensureLocalStorage();
  fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons, null, 2), 'utf-8');
}

export class LearningService {
  async getLessons(statusFilter?: string): Promise<StrategicLesson[]> {
    const lessons = getLocalLessons();
    if (statusFilter && statusFilter !== 'ALL') {
      return lessons.filter((l) => l.status === statusFilter);
    }
    return lessons;
  }

  async saveCandidateLesson(title: string, content: string, category: string = 'GERAL', tags: string[] = []): Promise<StrategicLesson> {
    const lesson: StrategicLesson = {
      id: `lesson-${Date.now()}`,
      title,
      content,
      category,
      status: 'CANDIDATE',
      confidence: 0.7,
      evidence_count: 1,
      positive_outcomes: 0,
      negative_outcomes: 0,
      tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const lessons = getLocalLessons();
    lessons.unshift(lesson);
    saveLocalLessons(lessons);

    return lesson;
  }

  async updateLessonStatus(id: string, status: StrategicLesson['status']): Promise<StrategicLesson | null> {
    const lessons = getLocalLessons();
    const idx = lessons.findIndex((l) => l.id === id);
    if (idx >= 0) {
      lessons[idx].status = status;
      lessons[idx].updated_at = new Date().toISOString();
      saveLocalLessons(lessons);
      return lessons[idx];
    }
    return null;
  }
}

export const learningService = new LearningService();

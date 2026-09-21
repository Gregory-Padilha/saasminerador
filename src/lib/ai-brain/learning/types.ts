export type LearningStatus = 'CANDIDATE' | 'APPROVED' | 'VALIDATED' | 'REJECTED' | 'DEPRECATED';

export interface StrategicLesson {
  id: string;
  title: string;
  content: string;
  category: string;
  status: LearningStatus;
  confidence: number;
  evidence_count: number;
  positive_outcomes: number;
  negative_outcomes: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface LearningEvent {
  id: string;
  thread_id?: string;
  offer_id?: string;
  event_type: 'USER_FEEDBACK' | 'TEST_OUTCOME' | 'AI_CANDIDATE';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

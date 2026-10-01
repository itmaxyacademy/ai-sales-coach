export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'karyawan' | 'manager' | 'company_admin' | 'super_admin';
    companyId?: string | null;
  };
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  isActive: boolean;
}

export interface CourseDetail extends CourseSummary {
  rubrics: any[];
}

export interface CoachingHint {
  hint: string;
  category: string;
}

export interface CustomerState {
  emotion: string;
  objectionLevel: number;
  engagement: number;
}

export interface SessionResponse {
  session: {
    id: string;
    courseId: string;
    status: string;
    maxTurns: number;
  };
  openingMessage: string;
  initialCoaching: CoachingHint;
  customerState: CustomerState;
}

export interface ChatResponse {
  customerResponse: string;
  postTurnCoaching?: CoachingHint;
  preTurnCoaching?: CoachingHint;
  customerState: CustomerState;
  sessionMeta: {
    shouldEnd: boolean;
    reason: string | null;
    turnsRemaining: number;
  };
}

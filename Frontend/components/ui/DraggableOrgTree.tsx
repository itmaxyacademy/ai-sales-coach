"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface OrgTeam {
  id: string;
  name: string;
  managers: OrgUser[];
  members: OrgUser[];
}

export interface OrgData {
  companyName: string;
  teams: OrgTeam[];
  unassignedMembers: OrgUser[];
}

interface DraggableOrgTreeProps {
  data: OrgData;
  onAssignUserToTeam: (userId: string, teamId: string | null, newRole?: "manager" | "karyawan") => void;
  canDrag: boolean;
}

const KonvaTree = dynamic(() => import("./KonvaTree"), { 
  ssr: false,
  loading: () => <div className="w-full h-[600px] bg-[#f8fafc] rounded-xl border border-slate-200 animate-pulse flex items-center justify-center text-slate-400">Loading Canvas...</div>
});

export function DraggableOrgTree(props: DraggableOrgTreeProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-[600px] bg-[#f8fafc] rounded-xl border border-slate-200 animate-pulse"></div>;
  }

  return <KonvaTree {...props} />;
}

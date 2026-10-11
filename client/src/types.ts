export type JobStatus = 'Quoted' | 'PO Received' | 'Subbie Notified' | 'Works Complete' | 'Invoiced' | 'Paid' | 'Closed';
export type SubbieInvoiceStatus = 'pending' | 'received' | 'approved' | 'disputed' | 'paid';
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  display_name: string;
  email: string | null;
  is_active: number;
  created_at: string;
}

export interface BusinessEntity {
  id: string;
  name: string;
  code: string;
}

export interface Site {
  id: string;
  name: string;
  mw_output: number;
  site_type: 'solar' | 'wind' | 'other';
  business_entity_id: string;
  entity_name?: string;
  entity_code?: string;
}

export interface Service {
  id: string;
  name: string;
  short_code: string;
  category: string;
  client_rate_per_mw: number;
  subbie_rate_per_mw: number;
  assigned_subbie_id: string;
  subbie_name?: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  contact_email: string;
  service_category: string;
}

export interface Job {
  id: string;
  site_id: string;
  service_id: string;
  status: JobStatus;
  client_po_number: string | null;
  subbie_po_number: string | null;
  quote_amount: number;
  subbie_cost: number;
  invoice_number: string | null;
  invoice_amount: number | null;
  subbie_invoice_number: string | null;
  subbie_invoiced_amount: number | null;
  subbie_invoice_status: SubbieInvoiceStatus;
  report_link: string | null;
  photo_link: string | null;
  folder_path: string | null;
  authorised_date: string | null;
  works_complete_date: string | null;
  invoiced_date: string | null;
  paid_date: string | null;
  closed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  site_name?: string;
  mw_output?: number;
  entity_name?: string;
  entity_code?: string;
  service_name?: string;
  short_code?: string;
  service_category?: string;
  subbie_name?: string;
  subbie_email?: string;
}

export interface ContactMatrix {
  id: string;
  business_entity_id: string;
  job_category: string;
  to_emails: string;
  cc_emails: string;
  entity_name?: string;
  entity_code?: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';
export type InvoiceMode = 'split' | 'combined';

export interface QuoteLine {
  id: string;
  quote_id: string;
  site_id: string;
  service_id: string;
  mw_output: number;
  client_rate_per_mw: number;
  subbie_rate_per_mw: number;
  line_amount: number;
  subbie_cost: number;
  job_id: string | null;
  sort_order: number;
  // Joined
  site_name?: string;
  site_type?: string;
  service_name?: string;
  short_code?: string;
  category?: string;
  subbie_name?: string;
  subbie_email?: string;
}

export interface Quote {
  id: string;
  quote_ref: string;
  business_entity_id: string;
  status: QuoteStatus;
  invoice_mode: InvoiceMode;
  client_po_number: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  entity_name?: string;
  entity_code?: string;
  line_count?: number;
  lines?: QuoteLine[];
}

export interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  statusCounts: {
    quoted: number;
    poReceived: number;
    subbieNotified: number;
    worksComplete: number;
    invoiced: number;
    paid: number;
    closed: number;
  };
  outstandingBalance: number;
  overdueJobs: number;
  overdueInvoices: number;
  totalRevenue: number;
  totalCosts: number;
  profit: number;
  vatLiability: number;
  recentJobs: Job[];
  jobsByStatus: Job[];
  revenueBySite: { site_name: string; revenue: number; cost: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
}

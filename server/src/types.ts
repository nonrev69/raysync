export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  username: string;
  password_hash?: string;
  role: UserRole;
  display_name: string;
  email: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessEntity {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Site {
  id: string;
  name: string;
  mw_output: number;
  site_type: 'solar' | 'wind' | 'other';
  business_entity_id: string;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  short_code: string;
  category: string;
  client_rate_per_mw: number;
  subbie_rate_per_mw: number;
  assigned_subbie_id: string;
  created_at: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  contact_email: string;
  service_category: string;
  created_at: string;
}

export type JobStatus = 'Quoted' | 'PO Received' | 'Subbie Notified' | 'Works Complete' | 'Invoiced' | 'Paid' | 'Closed';
export type SubbieInvoiceStatus = 'pending' | 'received' | 'approved' | 'disputed' | 'paid';

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
}

export interface ContactMatrix {
  id: string;
  business_entity_id: string;
  job_category: string;
  to_emails: string;
  cc_emails: string;
  created_at: string;
}

export interface RateOverride {
  id: string;
  site_id: string;
  service_id: string;
  client_rate_per_mw: number;
  subbie_rate_per_mw: number;
  effective_date: string;
  created_at: string;
}

export interface RateAuditEntry {
  id: string;
  service_id: string;
  old_client_rate: number | null;
  new_client_rate: number | null;
  old_subbie_rate: number | null;
  new_subbie_rate: number | null;
  changed_at: string;
  changed_by: string | null;
}

export interface AuthPayload {
  userId: string;
  username: string;
  role: UserRole;
}

import { downloadFile } from '@/shared/lib/download'

export function exportCustomerData(customerId: number, filename: string): Promise<void> {
  return downloadFile(`/customers/${customerId}/export-data/`, filename)
}

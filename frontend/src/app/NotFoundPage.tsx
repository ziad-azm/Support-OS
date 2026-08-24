import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div>
      <p>Page not found.</p>
      <Link to="/">Go home</Link>
    </div>
  )
}

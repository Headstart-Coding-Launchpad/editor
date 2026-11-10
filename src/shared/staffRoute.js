// Whether a URL is a staff page (tutor, admin, builder), so the route-level error card can be the
// plain tutor card rather than the child's emoji card (R2). Read from the router in App.jsx and
// LessonRoute.jsx: /lesson/:id?teacher=true (tutor window; with present=true, the presentation)
// and ?preview=true are staff; /room/:handle is the student's class link and stays a child page.
const STAFF_PATHS = /^\/(admin|builder|account|login|shot)(\/|$)/

export function isStaffRoute(pathname, search) {
  if (STAFF_PATHS.test(pathname ?? '')) return true
  const params = new URLSearchParams(search ?? '')
  return params.get('teacher') === 'true' || params.get('preview') === 'true'
}

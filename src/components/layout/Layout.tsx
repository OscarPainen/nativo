import { Outlet } from 'react-router-dom';
import Nav from './Nav';

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

import {DashboardSidebar, NavItem} from "./DashboardSidebar"
import {DashboardHeader} from "./DashboardHeader"

interface DashboardLayoutProps {
    children: React.ReactNode
    title?: string
    navItems: NavItem[]
    userName?: string
    userEmail?: string
}

export function DashboardLayout({children, navItems, userName, userEmail}: DashboardLayoutProps) {
    return (
        <div className="layout-container">
            <DashboardSidebar items={navItems}/>
            <div className="layout-page">
                <DashboardHeader userName={userName} userEmail={userEmail}/>
                <div className="content-wrapper">
                    <div className="container-xxl flex-grow-1 container-p-y">
                        {children}
                    </div>

                    <footer className="content-footer footer bg-footer-theme">
                        <div className="container-xxl">
                            <div
                                className="footer-container d-flex align-items-center justify-content-between py-4 flex-md-row flex-column">
                                <div className="mb-2 mb-md-0">
                                    © {new Date().getFullYear()} NEXUS. Все права защищены.
                                </div>
                            </div>
                        </div>
                    </footer>

                    <div className="content-backdrop fade"/>
                </div>
            </div>
        </div>
    )
}

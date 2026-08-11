"use client"

import {Modal} from "@/components/ui/modal"
import {useIsMobile} from "./hooks/useIsMobile"
import {useIntroVideo} from "./hooks/useIntroVideo"
import {useProfileSheet} from "./hooks/useProfileSheet"
import {useWorkViewer} from "./hooks/useWorkViewer"
import {ProfileBody} from "./ProfileBody"
import {ProfileHeader} from "./ProfileHeader"
import {MobileVideoLayout} from "./MobileVideoLayout"
import {DesktopProfileLayout} from "./DesktopProfileLayout"
import {WorkViewerModal} from "./WorkViewerModal"
import type {DesignerProfileModalProps} from "./types"

export function DesignerProfileModal({designer, onClose}: DesignerProfileModalProps) {
    const isMobile = useIsMobile()
    const d = designer

    const hasVideo = !!d?.introVideoUrl
    const works = d?.portfolioImages ?? []
    const mobileVideoLayout = isMobile && hasVideo
    const designerKey = d ? `${d.name}|${d.portrait}|${d.work}` : ""

    const {videoRef, muted, toggleMute} = useIntroVideo(d?.introVideoUrl)
    const sheet = useProfileSheet(mobileVideoLayout, designerKey)
    const workViewer = useWorkViewer(works, designerKey)

    if (!d) return null

    const profileContent = (
        <ProfileBody
            designer={d}
            works={works}
            onOpenWork={workViewer.setWorkViewerIdx}
        />
    )

    return (
        <>
            <Modal
                open
                maxWidth={hasVideo && !isMobile ? 840 : 560}
                onClose={onClose}
                theme="dark"
                variant={mobileVideoLayout ? "transparent" : "glass"}
                className={mobileVideoLayout ? "!max-w-[min(100%,420px)] !shadow-none" : undefined}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: mobileVideoLayout ? "column" : "row",
                        height: mobileVideoLayout ? "min(92vh, 720px)" : "min(82vh, 640px)",
                        overflow: mobileVideoLayout ? "visible" : "hidden",
                        position: "relative",
                        background: "transparent",
                    }}
                >
                    {mobileVideoLayout && d.introVideoUrl ? (
                        <MobileVideoLayout
                            videoRef={videoRef}
                            videoSrc={d.introVideoUrl}
                            muted={muted}
                            onToggleMute={toggleMute}
                            onClose={onClose}
                            sheet={sheet}
                        >
                            <ProfileHeader designer={d} compact/>
                            {profileContent}
                        </MobileVideoLayout>
                    ) : (
                        <DesktopProfileLayout
                            designer={d}
                            hasVideo={hasVideo}
                            videoRef={videoRef}
                            muted={muted}
                            onToggleMute={toggleMute}
                            onClose={onClose}
                        >
                            {profileContent}
                        </DesktopProfileLayout>
                    )}
                </div>
            </Modal>

            <WorkViewerModal
                open={workViewer.viewerOpen}
                works={works}
                activeIndex={workViewer.workViewerIdx ?? 0}
                activeSrc={workViewer.activeWork}
                onClose={() => workViewer.setWorkViewerIdx(null)}
                onPrev={workViewer.goPrev}
                onNext={workViewer.goNext}
            />
        </>
    )
}

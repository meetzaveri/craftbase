import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoSVG from '../../assets/logo.svg'
import TwitterLogoSVG from '../../assets/twitter_logo.svg'
import GithubLogoSVG from '../../assets/github_logo.svg'
import RightArrowWhiteSVG from '../../assets/right_arrow_white.svg'
import CustomizeSVG from '../../assets/customize.svg'
import NoSignupSVG from '../../assets/no_signup.svg'
import BlueStarSVG from '../../assets/blue_star.svg'

// import ImageContainer from '../../components/ProgressiveImageLoader/loader'
// import CraftbaseBoardScreenshotPNG from '../../assets/craftbase_board_screenshot.png'
// import CraftbaseBoardScreenshotBlurJPG from '../../assets/blur_craftbase_screenshot.jpg'
import Brainstorming from '../../assets/brainstorming_craftbase.png'
import Button from '../../components/common/button'

const HomePage: React.FC = () => {
    // create user mutation
    const [pageHeight, setPageHeight] = useState(0)
    const [btnId, setBtnId] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        console.log('window.innerHeight', window.innerHeight)
        setPageHeight(window.innerHeight - 200)
    }, [window.innerHeight])

    const onCreateCanvas = (e: React.MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement & { name?: string }
        setBtnId(target.name ?? null)
        navigate(`/`)
    }

    return (
        <>
            {/* <Redirect to={`/board/03a3706e-fe79-4df5-80f6-2f4040ade05f`} /> */}
            <div
                className="home-page-container relative bg-canvas "
                // style={{ height: `${pageHeight}px` }}
            >
                <nav
                    className="flex items-center w-full px-5 py-1 lg:py-2 2xl:py-4
                 bg-sidebar border-b border-border-panel
                 "
                >
                    <div className="w-1/2 flex items-center ">
                        <div>
                            <img
                                src={LogoSVG}
                                alt="Craftbase"
                                className="w-4 h-4
                            lg:w-6 lg:h-6
                            2xl:w-8 2xl:h-8
                            "
                            />
                        </div>
                        <div
                            className="pl-2
                        text-ink text-base lg:text-xl 2xl:text-2xl font-bold font-display"
                        >
                            craftbase
                        </div>
                        <div className="text-ink-muted pl-2 text-sm">
                            {' '}
                            (Beta version)
                        </div>
                    </div>

                    <div className="pl-5 w-1/2 flex items-center justify-end ">
                        <div className="pl-4 flex items-center ">
                            <div className=" flex items-center">
                                <a href="https://twitter.com/craftbase_org">
                                    <img
                                        className="w-5 h-5"
                                        src={TwitterLogoSVG}
                                    />
                                </a>
                                <a
                                    className="pl-2"
                                    href="https://github.com/craftbase-org"
                                >
                                    <img
                                        className="w-6 h-6"
                                        src={GithubLogoSVG}
                                    />
                                </a>
                            </div>

                            <Button
                                intent="primary"
                                size="medium"
                                name="create_canvas"
                                label="New Canvas"
                                onClick={onCreateCanvas}
                                extendClass="font-semibold shadow-card hover:shadow-card-accent ml-4"
                            />
                        </div>
                    </div>
                </nav>

                <div className="px-10 desktop:px-20 big-desktop:px-32 ultra-desktop:px-40">
                    <div
                        className="w-full
                        h-full mt-16
                        flex items-center  flex-wrap"
                    >
                        <div className="w-full lg:w-5/12 h-full flex items-center justify-center">
                            <div className="text-left transition-opacity duration-300 ease-in-out">
                                <h1 className="text-base lg:text-3xl 2xl:text-4xl font-bold font-display">
                                    Instant Infinite Whiteboard with Unique
                                    Shareable Board Links
                                </h1>
                                <p className="pt-4 2xl:pt-8 text-sm lg:text-lg 2xl:text-xl ">
                                    Start brainstorming in craftbase. Create as
                                    much as shared boards as you like. Each
                                    shared board gets a unique URL. No accounts.
                                    No login/signup. Just start thinking.
                                </p>
                                {/* <p className="pt-4 2xl:pt-8 text-sm lg:text-lg 2xl:text-xl ">
                                    With real-time updates across all devices,
                                    you can collaborate with your peers in
                                    real-time just by sharing them the board
                                    link.
                                </p> */}
                                <div className="mt-4">
                                    <Button
                                        intent="primary"
                                        name="start_now"
                                        // label="Let's create board"

                                        size="large"
                                        onClick={onCreateCanvas}
                                        extendClass="font-semibold primary-btn-home shadow-card hover:shadow-card-accent"
                                    >
                                        <div className="flex items-center">
                                            <span>Start on empty canvas</span>
                                            <img
                                                className="ml-2 home-arrow-icon w-6 h-6"
                                                src={RightArrowWhiteSVG}
                                            />
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="w-full lg:w-7/12 pt-8 lg:pt-0 h-full ">
                            <div className="lg:pl-4 w-full flex items-center lg:justify-end justify-center ">
                                <img
                                    src={Brainstorming}
                                    alt="Craftbase brainstorming"
                                    className="w-full lg:w-11/12 shadow-md"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-20">
                        <div className="w-full flex  flex-wrap">
                            <div className="w-full sm:w-1/3">
                                <div>
                                    <img
                                        src={NoSignupSVG}
                                        className="w-10 h-10 big-desktop:w-14 big-desktop:h-14 mx-auto"
                                    />
                                </div>
                                <div className=" px-8 lg:px-20 big-desktop:text-lg text-center">
                                    <p className="mt-4 text-ink font-bold font-display">
                                        No sign-up(s) needed
                                    </p>
                                    <p className="mt-2">
                                        Create as many boards you want without
                                        registering or signing up on platform.
                                    </p>
                                </div>
                            </div>
                            <div className="w-full sm:w-1/3 pt-8 sm:pt-0">
                                <div>
                                    <img
                                        src={BlueStarSVG}
                                        className="w-10 h-10 big-desktop:w-14 big-desktop:h-14 mx-auto"
                                    />
                                </div>
                                <div className=" px-8 lg:px-20 big-desktop:text-lg text-center">
                                    <p className="mt-4 text-ink font-bold font-display">
                                        Open Source at its core
                                    </p>
                                    <p className="mt-2">
                                        We beleive in open code. Contribute to
                                        grow this project or download the source
                                        code, tweak and customize it for your
                                        needs.
                                    </p>
                                </div>
                            </div>
                            <div className="w-full sm:w-1/3 pt-8 sm:pt-0">
                                <div>
                                    <img
                                        src={CustomizeSVG}
                                        className="w-10 h-10 big-desktop:w-14 big-desktop:h-14 mx-auto"
                                    />
                                </div>
                                <div className=" px-8 lg:px-20 big-desktop:text-lg text-center">
                                    <p className="mt-4 text-ink font-bold font-display">
                                        Customization
                                    </p>
                                    <p className="mt-2">
                                        We are constantly updating to make it
                                        more customizable than ever
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-20 w-full flex items-center justify-center">
                        <hr className="border-t border-border-panel w-2/4" />
                    </div>

                    {/* <div className="mt-8">
                    <div className="font-bold text-2xl">Support and Help</div>

                    <div className="mt-4">
                        Please contact{' '}
                        <a href="mailto:support@craftbase.org">
                            support@craftbase.org
                        </a>
                    </div>
                </div> */}

                    {/* <div className="mt-8 pt-20"> </div> */}
                </div>
                <footer
                    className="
                    w-full  px-10 2xl:px-20
                     bg-sidebar border-t border-border-panel  h-20
                flex items-center justify-between"
                >
                    <div className="text-sm big-desktop:text-base text-ink-mid">
                        © 2026 Craftbase. All rights reserved.
                    </div>
                    <div className=" flex items-center">
                        <a href="https://twitter.com/craftbase_org">
                            <img className="w-6 h-6" src={TwitterLogoSVG} />
                        </a>
                        <a
                            className="pl-2"
                            href="https://github.com/craftbase-org"
                        >
                            <img className="w-7 h-7" src={GithubLogoSVG} />
                        </a>
                    </div>
                </footer>
            </div>
        </>
    )
}

export default HomePage

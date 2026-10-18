import { ReactNode, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Swiper as SwiperType } from 'swiper';
import { SectorHeader } from '../../../../components/littleSectorHeader';

import './style.scss';
import classNames from 'classnames';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

import { Navigation, Pagination } from 'swiper/modules';
import { InstructionItemComponent } from './item';
import { ImageButton } from '../../../../components/imageButton';
import { useDispatch, useSelector } from 'react-redux';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../../store/selectors/translations';
import { agentModeInstructions, instructions } from '../../../../../model/help';
import { setInstructionExpanded } from '../../../../store/slices/persistence';
import { useInstructionsExpanded } from '../../../../store/selectors/program';
import { useIsAgentMode } from '../../../../hooks/useAgentMode';
import { useIsMobile } from '../../../../hooks/useMobile';
import { HotkeysSlide } from '../../hotkeys/HotkeysSlide.tsx';

/** Слайд о сочетаниях идёт после первого документа и агента: сначала главное, потом ускорение */
const HOTKEYS_SLIDE_INDEX = 2;

export const Instruction = () => {
    const swiperRef = useRef<SwiperType | null>(null);
    const instructionExpanded = useSelector(useInstructionsExpanded);
    const dictionary = useSelector(useDictionary);
    const dispatch = useDispatch();
    const language = useSelector(useCurrentLanguage);
    const isAgentMode = useIsAgentMode();
    const isMobile = useIsMobile();
    const slides: ReactNode[] = (
        isAgentMode ? agentModeInstructions : instructions
    ).map((instruction, index) => (
        <InstructionItemComponent key={index} item={instruction[language]} />
    ));
    // GH-172: на телефоне клавиатуры нет, а в агентском режиме почти все сочетания про редактор
    if (!isAgentMode && !isMobile) {
        slides.splice(HOTKEYS_SLIDE_INDEX, 0, <HotkeysSlide key="hotkeys" />);
    }
    const hasSeveralSlides = slides.length > 1;

    return (
        <div className={classNames('labkeeper-instruction-container')}>
            <SectorHeader
                expanded={instructionExpanded}
                onPressExpanded={() =>
                    dispatch(setInstructionExpanded(!instructionExpanded))
                }
                title={dictionary.instructions.label}
            />
            {instructionExpanded ? (
                <div className="labkeeper-instruction-body">
                    <Swiper
                        key={isAgentMode ? 'agent' : 'editor'}
                        spaceBetween={0}
                        width={undefined}
                        slidesPerView={1}
                        onSwiper={(swiper) => (swiperRef.current = swiper)}
                        cssMode
                        pagination={
                            hasSeveralSlides
                                ? {
                                      clickable: true,
                                      bulletClass: 'swiper-pagination-bullet',
                                      bulletActiveClass:
                                          'swiper-pagination-bullet-active',
                                  }
                                : false
                        }
                        navigation={false}
                        onSlideChange={(sw) => sw.activeIndex}
                        modules={[Pagination, Navigation]}
                    >
                        {slides.map((slide, index) => (
                            <SwiperSlide key={index}>{slide}</SwiperSlide>
                        ))}
                    </Swiper>
                    {hasSeveralSlides ? (
                        <>
                            <div className="nav-button left">
                                <ImageButton
                                    onClick={() =>
                                        swiperRef.current?.slidePrev()
                                    }
                                    rotate
                                    type="primary"
                                />
                            </div>
                            <div className="nav-button right">
                                <ImageButton
                                    onClick={() => {
                                        swiperRef.current?.slideNext();
                                    }}
                                    type="primary"
                                />
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

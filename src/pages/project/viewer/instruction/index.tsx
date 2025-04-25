import { useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Swiper as SwiperType } from 'swiper';
import { SectorHeader } from '../../../../shared/components/littleSectorHeader';

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
import { useDictionary } from '../../../../store/selectors/translations';
import { instructions } from '../../../../shared/help';
import { StorageState } from '../../../../store';
import { setInstructionExpanded } from '../../../../store/slices/persistence';

export const Instruction = () => {
    const swiperRef = useRef<SwiperType | null>(null);
    const instructionExpanded = useSelector(
        (state: StorageState) => state.persistence.instructionExpanded
    );
    const dictionary = useSelector(useDictionary);
    const dispatch = useDispatch();
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );

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
                <div
                    style={{
                        height: 214,
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        padding: '0 16px',
                    }}
                >
                    <Swiper
                        style={{ height: '100%' }}
                        spaceBetween={50}
                        slidesPerView={1}
                        onSwiper={(swiper) => (swiperRef.current = swiper)}
                        cssMode
                        pagination={{
                            clickable: true,
                            bulletClass: 'swiper-pagination-bullet',
                            bulletActiveClass:
                                'swiper-pagination-bullet-active',
                        }}
                        navigation={false}
                        onSlideChange={(sw) => sw.activeIndex}
                        modules={[Pagination, Navigation]}
                    >
                        {instructions.map((instruction, index) => (
                            <SwiperSlide key={index}>
                                <InstructionItemComponent
                                    item={instruction[language]}
                                />
                            </SwiperSlide>
                        ))}
                    </Swiper>
                    <div className="nav-button left">
                        <ImageButton
                            onClick={() => swiperRef.current?.slidePrev()}
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
                </div>
            ) : null}
        </div>
    );
};

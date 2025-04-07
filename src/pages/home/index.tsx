import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Routes } from '../../routing/routes';
import { useUser } from '../../store/selectors/program';

export const HomePage = () => {
    const user = useSelector(useUser);
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user.isAuthenticated) {
            if (id && id !== 'default' && isNaN(+id)) {
                return;
            }
            navigate(Routes.ProjectDefault);
            return;
        }
        navigate(Routes.Projects);
    }, [user.isAuthenticated, navigate]);

    return <></>;
};

import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";

const PrivateRoute = () => {
	const { user } = useAuthContext();
	console.log(user);

	return <>{user ? <Outlet /> : <Navigate to="/sign-in" />}</>;
};

export default PrivateRoute;

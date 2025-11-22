import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import "./FancySignInButton.css";

const FancySignInButton = () => {
  const navigate = useNavigate();

  return (
    <div className="like-button" onClick={() => navigate("/auth")}>
      <input className="on" id="signin" type="checkbox" />
      <label className="like" htmlFor="signin">
        <User className="like-icon" />
        <span className="like-text">Sign In</span>
      </label>
      <span className="like-count one">→</span>
      <span className="like-count two">Go</span>
    </div>
  );
};

export default FancySignInButton;

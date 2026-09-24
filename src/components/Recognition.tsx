import "./styles/Recognition.css";
import { config } from "../config";

const Recognition = () => {
  return (
    <div className="recognition-section section-container">
      <h2>
        Recog<span>nition</span>
      </h2>
      <div className="recognition-list">
        {config.recognition.map((item) => (
          <div className="recognition-row" key={item.title}>
            {item.year && <span className="recognition-year">{item.year}</span>}
            <div className="recognition-body">
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recognition;

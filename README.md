# Qi Yang

Machine Learning Engineer focused on ML Systems, scalable training, and production deployment.

## What I build
- Production backend systems (SpringBoot, Kubernetes, Redis, MySQL/TiDB)
- GPU training and performance optimization
- End-to-end ML pipelines (train → evaluate → deploy)

## Highlights
- 93.3% sensitivity lung nodule detection model trained on 60GB CT data using 6× RTX 3060Ti (CUDA), deployed to clinical workflow
- Enterprise microservices @ SAIC: high concurrency, millisecond-level latency optimization, Redis caching
- AI annotation platform @ Tencent: 100k images/day, async loading and UI performance improvements

## Links
- GitHub: https://github.com/QiYang-Orbit
- LinkedIn: https://www.linkedin.com/in/qiyangcs
- Paper: https://link.springer.com/chapter/10.1007/978-981-99-1645-0_28


## Notes on Model Serving
What: Model serving system turns a trained model into an online service that users can call.  
Solve: solves how to serve predictions reliably with low latency and high concurrency.  
Includes:  
- Model loader  
- API server  
- Inference execution  
- Logging & Monitoring  
- Containerization(Docker)  

Data flow:  
User request -> API -> Model inference -> return prediction  
Common tools like: FastAPI, Flask, TorchServe, Tensorflow Serving, Docker.
